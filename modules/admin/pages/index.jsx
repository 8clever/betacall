import React from "react";
import {
    Layout,
    Scroll,
    DatePicker,
    TimePicker,
    Panel,
    Pagination
} from "../components/index.jsx"
import { 
    Socket,
    checkAuth, 
    I18n, 
    __,
    withError,
    api,
    token,
    Component,
    redirect
} from "../utils/index.jsx";
import {
    Alert,
    Card,
    CardBody,
    CardTitle,
    Label,
    FormGroup,
    Input,
    Table,
    Button,
    Modal,
    ModalBody,
    ModalHeader,
    ModalFooter
} from "reactstrap";
import _ from "lodash";
import moment from "moment";

class AdminPage extends React.Component {

    componentDidMount () {
        this.refreshInterval = setInterval(() => {
            global.router.reload();
        }, 30000);
    }

    componentWillUnmount () {
        clearInterval(this.refreshInterval);
    }

    resetSystem () {
        return () => {
            withError(async () => {
                await api("asterisk.restart", token.get(), {});
                global.router.reload();
            })
        }
    }

    render() {
        let { user, orders, limit, filter  } = this.props;
        const i18n = new I18n(user);

        return (
            <Layout title={ i18n.t("Home") } page="home" user={user}>
                <Scroll>
                    <Card>
                        <CardBody>
                            <CardTitle>{i18n.t("Call Orders")}</CardTitle>
                            
                            {
                                orders.list.length ?
                                null :
                                <Alert>
                                    <b>{i18n.t("Information")}</b>
                                    <p>{i18n.t("You not have active orders.")}</p>
                                </Alert>
                            }

                            <Table>
                                <thead>
                                    <tr>
                                        <th>{i18n.t("Order ID")}</th>
                                        <th>{i18n.t("Phone")}</th>
                                        <th>{i18n.t("Client")}</th>
                                        <th>{i18n.t("Delivery Type")}</th>
                                        <th>{i18n.t("Full Price")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {
                                        _.map(orders.list, (order, key) => {
                                            return (
                                                <tr key={key}>
                                                    <td>{_.get(order, "orderIdentity.orderId")}</td>
                                                    <td>{_.get(order, "clientInfo.phone")}</td>
                                                    <td>{_.get(order, "clientInfo.fio")}</td>
                                                    <td>{_.get(order, "deliveryType")}</td>
                                                    <td>{_.get(order, "clientFullCost")} p.</td>
                                                </tr>
                                            )
                                        })
                                    }
                                </tbody>
                            </Table>
                        </CardBody>
                    </Card>

                    <div className="mb-2"></div>

                    <Pagination 
                        limit={limit}
                        count={orders.count}
                        filter={filter}
                    />
                </Scroll>
            </Layout>
        );
    }
}

class OperatorPage extends Component {
    constructor (props) {
        super(props);
        this.state = {
            order: props.order
        };
    }

    componentDidMount () {
        let { user } = this.props;
        this.socket = Socket.connect();
        this.socket.on(user._id, (evt) => {
            let { orderId } = evt;

            withError(async () => {
                await api("order.addToMyOrders", token.get(), { orderId });
                global.router.reload();
            });
        });
    }

    componentWillUnmount () {
        this.socket.close();
        this.socket = null;
    }

    UNSAFE_componentWillReceiveProps (props) {
        this.setState({ order: props.order });
    }

    static get state () {
        return {
            replaceModal: "state-replace-modal",
            doneModal: "state-done-modal",
            denyModal: "state-deny-modal",
            skipModal: "state-skip-modal"
        }
    }

    replaceDate () {
        return () => {
            withError(async () => {
                let { order } = _.cloneDeep(this.state);
                await api("order.replaceCallDate", token.get(), {
                    order: order.info,
                    replaceDate: order.replaceDate
                });
                this.dropPhone()();
                global.router.reload();
                this.toggle(OperatorPage.state.replaceModal)();
            });
        }
    }

    setDone () {
        return () => {
            let { order, pickupId } = _.cloneDeep(this.state);
            withError(async () => {
                if (order.info.deliveryType === __.DELIVERY_TYPE.PICKUP) {
                    await api("order.doneOrderPickup", token.get(), {
                        order: order.info,
                        pickupId
                    });
                } else {
                    await api("order.doneOrder", token.get(), { order: order.info });
                }
                this.dropPhone()();
                global.router.reload();
                this.toggle(OperatorPage.state.doneModal)();
            });
        }
    }

    setDeny () {
        return () => {
            let { order } = _.cloneDeep(this.state);
            withError(async () => {
                await api("order.denyOrder",token.get(), {
                    order: order.info
                });
                this.dropPhone()();
                global.router.reload();
                this.toggle(OperatorPage.state.denyModal)();
            });
        }
    }

    dropPhone() {
        return () => {
            let { user } = this.props;
            let { order } = _.cloneDeep(this.state);
            let orderId = _.get(order, "info.orderIdentity.orderId");
            let idSocketDone = `${user._id}-${orderId}`;
            this.socket.emit("msg", {
                evtid: idSocketDone,
                done: 1
            });
        }
    }

    skipOrder() {
        return () => {
            let { order } = _.cloneDeep(this.state);
            withError(async () => {
                await api("order.skipOrder",token.get(), {
                    order: order.info
                });
                this.dropPhone()();
                global.router.reload();
                this.toggle(OperatorPage.state.skipModal)();
            });
        }
    }

    get (root, path, def) {
        return _.get(root, path) || def;
    }

    convertToYYYYMMDD (date, format) {
        return _.isDate(date) && moment(date).format(format) || "";
    }

    render() {
        let { user, orders, filter } = this.props;
        let { order } = this.state;
        const i18n = new I18n(user);

        let desiredDate = this.get(order, "info.desiredDateDelivery.date", "");
        let storageDate = this.get(order, "info.endOfStorageDate", "");

        desiredDate = this.convertToYYYYMMDD(desiredDate, "YYYY-MM-DD");
        storageDate = this.convertToYYYYMMDD(storageDate, "YYYY-MM-DD");

        return (
            <Layout title={ i18n.t("Home") } page="home" user={user}>
                {/** LEFT FORM */}
                <Scroll>
                    {
                        order ?
                        <div>
                            <Card>
                                <CardBody>
                                    <CardTitle>
                                        {i18n.t("Information about client")}
                                    </CardTitle>

                                    <FormGroup>
                                        <Label>{i18n.t("Name")}</Label>
                                        <Input 
                                            value={this.get(order, "info.clientInfo.fio", "")}
                                            onChange={this.change("order.info.clientInfo.fio")}
                                        />
                                    </FormGroup>

                                    <FormGroup>
                                        <Label>{i18n.t("Phone")}</Label>
                                        <Input
                                            value={this.get(order, "info.clientInfo.phone", "")}
                                            onChange={this.change("order.info.clientInfo.phone")}
                                        />
                                    </FormGroup>

                                    <FormGroup>
                                        <Label>{i18n.t("E-mail")}</Label>
                                        <Input
                                            value={this.get(order, "info.clientInfo.email", "")}
                                            onChange={this.change("order.info.clientInfo.email")}
                                        />
                                    </FormGroup>

                                    <FormGroup>
                                        <Label>{i18n.t("Comment")}</Label>
                                        <Input
                                            type="textarea"
                                            value={this.get(order, "info.clientInfo.comment", "")}
                                            onChange={this.change("order.info.clientInfo.comment")}
                                        />
                                    </FormGroup>

                                </CardBody>
                            </Card>
                            <div className="mb-2"></div>

                            <Card>
                                <CardBody>
                                    <CardTitle>
                                        {i18n.t("Information about delivery")}
                                    </CardTitle>

                                    <FormGroup>
                                        <Label>{i18n.t("Delivery Date")}</Label>
                                        <DatePicker 
                                            key={order.info.orderIdentity.orderId}
                                            value={desiredDate}
                                            onChange={this.change("order.info.desiredDateDelivery.date")}
                                            format="YYYY-MM-DD"
                                            mask={"9999-99-99"}
                                        />
                                    </FormGroup>

                                    <FormGroup>
                                        <Label>{i18n.t("Time from")}</Label>
                                        <TimePicker
                                            format="HH:mm:ss"
                                            mask="99:99:99"
                                            value={this.get(order, "info.desiredDateDelivery.timeInterval.bTime", "")}
                                            onChange={this.change("order.info.desiredDateDelivery.timeInterval.bTime")}
                                        />
                                    </FormGroup>

                                    <FormGroup>
                                        <Label>{i18n.t("Time to")}</Label>
                                        <TimePicker
                                            format="HH:mm:ss"
                                            mask="99:99:99"
                                            value={this.get(order, "info.desiredDateDelivery.timeInterval.eTime", "")}
                                            onChange={this.change("order.info.desiredDateDelivery.timeInterval.eTime")}
                                        />
                                    </FormGroup>

                                    <FormGroup>
                                        <Label>{i18n.t("Delivery Region")}</Label>
                                        <Input
                                            value={this.get(order, "info.deliveryAddress.region", "")}
                                            onChange={this.change("info.deliveryAddress.region")}
                                        />
                                    </FormGroup>

                                    <FormGroup>
                                        <Label>{i18n.t("Delivery City")}</Label>
                                        <Input
                                            value={this.get(order, "info.deliveryAddress.city", "")}
                                            onChange={this.change("info.deliveryAddress.city")}
                                        />
                                    </FormGroup>

                                    <FormGroup>
                                        <Label>{i18n.t("Zip Code")}</Label>
                                        <Input
                                            value={this.get(order, "info.deliveryAddress.zipcode", "")}
                                            onChange={this.change("info.deliveryAddress.zipcode")}
                                        />
                                    </FormGroup>

                                    <FormGroup>
                                        <Label>{i18n.t("Delivery Address")}</Label>
                                        <Input
                                            value={this.get(order, "info.deliveryAddress.inCityAddress.address", "")}
                                            onChange={this.change("info.deliveryAddress.inCityAddress.address")}
                                        />
                                    </FormGroup>

                                    <FormGroup check>
                                        <Label check>
                                            <Input 
                                                type="radio" 
                                                name="delivery-type"
                                                checked={this.get(order, "info.deliveryType") === __.DELIVERY_TYPE.COURIER}
                                                onChange={() => {
                                                    this.change("order.info.deliveryType")({ 
                                                        target: { 
                                                            value: __.DELIVERY_TYPE.COURIER
                                                        }
                                                    });
                                                }}
                                            /> 
                                            {i18n.t("Courier")}
                                        </Label>
                                    </FormGroup>

                                    <FormGroup check>
                                        <Label check>
                                            <Input 
                                                type="radio" 
                                                name="delivery-type"
                                                checked={this.get(order, "info.deliveryType") === __.DELIVERY_TYPE.PICKUP}
                                                onChange={() => {
                                                    this.change("order.info.deliveryType")({ 
                                                        target: { 
                                                            value: __.DELIVERY_TYPE.PICKUP
                                                        }
                                                    });
                                                }}
                                            /> 
                                            {i18n.t("Pickup")} 
                                        </Label>
                                    </FormGroup>

                                    <div className="mb-2"></div>

                                    {
                                        this.get(order, "info.deliveryType") === __.DELIVERY_TYPE.PICKUP ?
                                        <FormGroup>
                                            <Label>{i18n.t("Pickup Point")}</Label>
                                            <Input
                                                type="select"
                                                value={this.get(this.state, "pickupId", "")}
                                                onChange={this.change("pickupId")}>
                                                <option value="">{i18n.t("Not Selected")}</option>
                                                {
                                                    _.map(order.info.pickupPoints, (point, idx) => {
                                                        return (
                                                            <option key={idx} value={point.locationId}>
                                                                {point.cityOfLocation} {point.addressOfLocation}
                                                            </option>
                                                        )
                                                    })
                                                }
                                            </Input>
                                        </FormGroup> : null
                                    }

                                </CardBody>
                            </Card>
                            <div className="mb-2"></div>
                        </div> : 
                        <div>
                            <Alert color="warning">
                                <b>{i18n.t("Information")}</b>
                                <p>
                                    {i18n.t("You not have available orders")}
                                </p>
                            </Alert>
                        </div>
                    }
                </Scroll>

                {/** RIGHT FORM */}
                <Scroll>
                    {
                        order ?
                        <div>
                            <Card>
                                <CardBody>
                                    <CardTitle>
                                        {i18n.t("Information about order")}
                                    </CardTitle>

                                    <Table bordered>
                                        <thead>
                                            <tr>
                                                <th>№ {i18n.t("Order")}</th>
                                                <th>{i18n.t("Bar Code")}</th>
                                                <th>№ {i18n.t("Order in market")}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td>{this.get(order, "info.orderIdentity.orderId", "")}</td>
                                                <td>{this.get(order, "info.orderIdentity.barcode", "")}</td>
                                                <td>{this.get(order, "info.orderIdentity.webshopNumber", "")}</td>
                                            </tr>
                                        </tbody>
                                    </Table>

                                    <FormGroup>
                                        <b>{i18n.t("status")}:</b> {this.get(order, "info.status.name", "")}
                                        <br/>
                                        <b>{i18n.t("work status")}:</b> {this.get(order, "info.workStatus.name", "")}
                                    </FormGroup>

                                    <FormGroup>
                                        <Label>{i18n.t("End of storage date")}</Label>
                                        <DatePicker
                                            value={storageDate}
                                            onChange={e => {
                                                let date = e.target.value;
                                                if (date) {
                                                    this.change("order.info.endOfStorageDate")({
                                                        target: { value: moment(date, "YYYY-MM-DD").toDate() }
                                                    });
                                                }
                                            }}
                                            format="YYYY-MM-DD"
                                            mask="9999-99-99"
                                        />
                                    </FormGroup>

                                    <b>{i18n.t("Full order price")}:</b> {this.get(order, "info.clientFullCost", "")} p.
                                </CardBody>
                            </Card>
                            <div className="mb-2"></div>

                            {/** ACTIONS */}
                            <Card>
                                <CardBody>
                                    <CardTitle>
                                        {i18n.t("Actions")}
                                    </CardTitle>

                                    <Button 
                                        onClick={this.toggle(OperatorPage.state.doneModal)}
                                        color="success">
                                        {i18n.t("Done")}
                                    </Button>
                                    <Modal isOpen={!!this.state[OperatorPage.state.doneModal]}>
                                        <ModalHeader className="bg-warning">{i18n.t("Attention")}</ModalHeader>
                                        <ModalBody>{i18n.t("Are you set status to done, and go next?")}</ModalBody>
                                        <ModalFooter>
                                            <Button 
                                                onClick={this.setDone()}
                                                color="warning">
                                                {i18n.t("Confirm")}
                                            </Button>
                                            <Button
                                                onClick={this.toggle(OperatorPage.state.doneModal)}
                                                color="light">
                                                {i18n.t("Cancel")}
                                            </Button>
                                        </ModalFooter>
                                    </Modal>

                                    {" "}
                                    <Button 
                                        onClick={this.toggle(OperatorPage.state.denyModal)}
                                        color="danger">
                                        {i18n.t("Deny")}
                                    </Button>
                                    <Modal isOpen={!!this.state[OperatorPage.state.denyModal]}>
                                        <ModalHeader className="bg-danger text-white">{i18n.t("Are you sure deny order?")}</ModalHeader>
                                        <ModalBody>
                                            <FormGroup>
                                                <Label>{i18n.t("Deny Cause")}</Label>
                                                <Input 
                                                    onChange={this.change("order.info.denyParams.reason.id")}
                                                    type="select">
                                                    <option value="">{i18n.t("Not Selected")}</option>
                                                    <option value={1}>{i18n.t("Delivery time violated")}</option>
                                                    <option value={2}>{i18n.t("No money available")}</option>
                                                    <option value={3}>{i18n.t("changed my mind to acquire")}</option>
                                                    <option value={4}>{i18n.t("Purchased in another store")}</option>
                                                    <option value={5}>{i18n.t("Did not order")}</option>
                                                    <option value={6}>{i18n.t("Not phoned / expired")}</option>
                                                    <option value={7}>{i18n.t("Other")}</option>
                                                    <option value={8}>{i18n.t("Size does not match the stated")}</option>
                                                    <option value={9}>{i18n.t("This product looks different than on the site.")}</option>
                                                    <option value={10}>{i18n.t("Not satisfied with the quality")}</option>
                                                    <option value={11}>{i18n.t("Another item deliverede")}</option>
                                                </Input>
                                            </FormGroup>
                                        </ModalBody>
                                        <ModalFooter>
                                            <Button 
                                                onClick={this.setDeny()}
                                                color="danger">
                                                {i18n.t("Confirm")}
                                            </Button>
                                            <Button
                                                onClick={this.toggle(OperatorPage.state.denyModal)}
                                                color="light">
                                                {i18n.t("Cancel")}
                                            </Button>
                                        </ModalFooter>
                                    </Modal>
                                    {" "}

                                    <Button 
                                        onClick={this.toggle(OperatorPage.state.skipModal)}
                                        color="primary">
                                        {i18n.t("Skip")}
                                    </Button>
                                    <Modal isOpen={!!this.state[OperatorPage.state.skipModal]}>
                                        <ModalHeader className="bg-warning">{i18n.t("Attention!")}</ModalHeader>
                                        <ModalBody>{i18n.t("Are you sure skip modal?")}</ModalBody>
                                        <ModalFooter>
                                            <Button
                                                onClick={this.skipOrder()}
                                                color="warning">
                                                {i18n.t("Confirm")}
                                            </Button>
                                            <Button
                                                onClick={this.toggle(OperatorPage.state.skipModal)}
                                                color="light">
                                                {i18n.t("Cancel")}
                                            </Button>
                                        </ModalFooter>
                                    </Modal>

                                </CardBody>
                            </Card>
                            <div className="mb-2"></div>

                            <Card>
                                <CardBody>
                                    <CardTitle>
                                        {i18n.t("Replace call")}
                                    </CardTitle>
                                    <FormGroup>
                                        <Label>{i18n.t("Date Call")}</Label>
                                        <DatePicker
                                            value={""}
                                            format={"YYYY-MM-DD"}
                                            mask={"9999-99-99"}
                                            onChange={e => {
                                                let date = e.target.value;
                                                if (date) {
                                                    this.change("order.replaceDate")({ 
                                                        target: {
                                                            value: moment(date, "YYYY-MM-DD").toDate()
                                                        }
                                                    });
                                                } 
                                            }}
                                        />
                                    </FormGroup>
                                    <Button
                                        onClick={this.toggle(OperatorPage.state.replaceModal)}
                                        color="warning">
                                        {i18n.t("Replace")}
                                    </Button>
                                    <Modal isOpen={!!this.state[OperatorPage.state.replaceModal]}>
                                        <ModalHeader className="bg-warning">{i18n.t("Attention")}</ModalHeader>
                                        <ModalBody>{i18n.t("Are you sure replace call and go next?")}</ModalBody>
                                        <ModalFooter>
                                            <Button 
                                                onClick={this.replaceDate()}
                                                color="warning">
                                                {i18n.t("Confirm")}
                                            </Button>
                                            <Button
                                                onClick={this.toggle(OperatorPage.state.replaceModal)}
                                                color="light">
                                                {i18n.t("Cancel")}
                                            </Button>
                                        </ModalFooter>
                                    </Modal>
                                </CardBody>
                            </Card>
                        </div>
                        : null
                    }
                </Scroll>
                <Scroll className="col-sm-2">
                    {
                        _.map(orders, (order, page) => {

                            return (
                                <Panel 
                                    key={page} 
                                    color={filter.page === page ? "primary" : "secondary"}
                                    onClick={() => { 
                                        redirect(null, "index", { page }) 
                                    }}>
                                    {_.get(order, "info.clientInfo.phone")}
                                    
                                    <br/>
                                    <small className="text-muted">{_.get(order, "info.clientInfo.fio")}</small>
                                </Panel>
                            )
                        })
                    }
                </Scroll>
            </Layout>
        )
    }
}

export default async (ctx) => {
    let u = await checkAuth(ctx);
    let filter = _.cloneDeep(ctx.req.query);
    let limit = 20;
    filter.page = parseInt(ctx.req.query.page || 0);

    if (u.role === __.ROLES.ADMIN) {
        let [ orders ] = await Promise.all([
            api("order.getOrders", token.get(ctx), {
                page: filter.page,
                limit
            })
        ]);
        return ctx.res._render(AdminPage, { 
            user: u, 
            orders,
            filter,
            limit
        });
    }

    let orders = await api("order.getMyOrders", token.get(ctx), {});
    let order = orders[filter.page] || orders[0] || null;

    return ctx.res._render(OperatorPage, { 
        user: u,
        orders,
        order,
        filter
    });
}