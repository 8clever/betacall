import React from "react";
import {
    Layout,
    Scroll,
    DatePicker,
    TimePicker,
    Fa,
    Panel
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
    Jumbotron,
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
    render() {
        let { user } = this.props;
        const i18n = new I18n(user);

        return (
            <Layout title={ i18n.t("Home") } page="home" user={user}>
                <Scroll>
                    <Jumbotron>
                        <h1 className="display-3">
                            { `${i18n.t("Hi") }, ${user.name}!`}
                        </h1>
                        <p className="lead">
                            { i18n.t("You are ADMIN user. You can create / edit users.") }
                        </p>
                    </Jumbotron>
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
        let { user, orders } = this.props;
        this.socket = Socket.connect();

        _.map(orders, order => {
            let phone = _.get(order, "info.clientInfo.phone");
            let idSocket = `${user._id}-dial-${phone}`;
            this.socket.on(idSocket , (evt) => {
                this.setState({ [`dial-${phone}`]: evt });
            });
        })
    }

    componentWillUnmount () {
        this.socket.close();
        this.socket = null;
    }

    UNSAFE_componentWillReceiveProps (props) {
        this.setState({ order: props.order });
    }

    call () {
        return () => {
            withError(async () => {
                let response = await api("asterisk.call", token.get(), { phone: "89066482837" });
                console.log(response)
            });
        }
    }

    static get state () {
        return {
            replaceModal: "state-replace-modal",
            doneModal: "state-done-modal",
            underCallModal: "state-under-call-modal",
            denyModal: "state-deny-modal"
        }
    }

    replaceDate () {
        return () => {
            withError(async () => {
                let { order } = _.cloneDeep(this.state);
                await api("order.editOrder", token.get(), {
                    data: {
                        _id: order._id,
                        _dt: order._dt,
                        _dtupdate: new Date(),
                        status: __.ORDER_STATUS.NEW
                    },
                    unset: {
                        _iduser: 1
                    }
                });
                global.router.reload();
                this.toggle(OperatorPage.state.replaceModal)();
            });
        }
    }

    setDone () {
        return () => {
            let { order } = _.cloneDeep(this.state);
            withError(async () => {
                await api("order.editOrder",token.get(), {
                    data: {
                        _id: order._id,
                        status: __.ORDER_STATUS.DONE,
                        info: order.info
                    }
                });
                global.router.reload();
                this.toggle(OperatorPage.state.doneModal)();
            });
        }
    }

    setUnderCall () {
        return () => {
            let { order } = _.cloneDeep(this.state);
            withError(async () => {
                await api("order.editOrder",token.get(), {
                    data: {
                        _id: order._id,
                        status: __.ORDER_STATUS.UNDER_CALL,
                        info: order.info
                    }
                });
                global.router.reload();
                this.toggle(OperatorPage.state.underCallModal)();
            });
        }
    }

    setDeny () {
        return () => {
            let { order } = _.cloneDeep(this.state);
            withError(async () => {
                await api("order.editOrder",token.get(), {
                    data: {
                        _id: order._id,
                        status: __.ORDER_STATUS.DENY,
                        info: order.info
                    }
                });
                global.router.reload();
                this.toggle(OperatorPage.state.denyModal)();
            });
        }
    }

    get (root, path, def) {
        return _.get(root, path) || def;
    }

    beginCall () {
        return () => {
            let { order } = _.cloneDeep(this.state);
            withError(async () => {
                let phone = this.get(order, "info.clientInfo.phone", "");
                if (!phone) throw new Error("Invalid phone number");

                await api("asterisk.call", token.get(), {
                    phone
                });
            })
        }
    }

    addNewOrder () {
        return () => {
            withError(async () => {
                let { user } = this.props;
                let orders = await api("order.getOrders", token.get(), {
                    query: {
                        _iduser: { $exists: 0 },
                        status: __.ORDER_STATUS.NEW
                    },
                    sort: {
                        _dt: -1
                    },
                    limit: 1
                });

                if (!orders.count) throw new Error("Sorry we not have new orders for you");

                let order = orders.list[0];
                await api("order.editOrder", token.get(), {
                    data: {
                        _id: order._id,
                        _iduser: user._id,
                        status: __.ORDER_STATUS.IN_PROGRESS
                    }
                });

                global.router.reload();
            });
        }
    }

    getDial (idx) {
        return () => {
            let { orders } = this.props;
            let phone = this.get(orders, `${idx}.info.clientInfo.phone`, "");
            let dial = this.get(this.state, `dial-${phone}`, { Event: "Hangup" });
            return dial;
        }
    }

    render() {
        let { user, orders, filter } = this.props;
        let { order } = this.state;
        const i18n = new I18n(user);

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
                                            value={this.get(order, "info.desiredDateDelivery.date", "")}
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
                                            <Label>{i18n.t("Pickup address")}</Label>
                                            <Input
                                                value={this.get(order, "info.deliveryAddress.pickupAddress", "")}
                                                onChange={this.change("order.info.deliveryAddress.pickupAddress")}
                                            />
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
                                            value={this.get(order, "info.endOfStorageDate", "")}
                                            onChange={this.change("order.info.endOfStorageDate")}
                                            format="YYYY-MM-DD"
                                            mask="9999-99-99"
                                        />
                                    </FormGroup>

                                    <b>{i18n.t("Full order price")}:</b> {this.get(order, "info.clientFullCost", "")} p.
                                </CardBody>
                            </Card>
                            <div className="mb-2"></div>

                            {/** DIAL */}
                            <Card>
                                <CardBody>
                                    <CardTitle>
                                        {i18n.t("Dial")}
                                        {" "}
                                        <small className="text-muted">{this.getDial(filter.page)().Event}</small>
                                    </CardTitle>
                                    <Button 
                                        disabled={this.getDial(filter.page)().Event !== "Hangup"}
                                        onClick={this.beginCall()}
                                        color="success">
                                        {i18n.t("Begin Call")} <Fa fa="phone"/>
                                    </Button>
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
                                    <Modal isOpen={this.state[OperatorPage.state.doneModal]}>
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
                                        onClick={this.toggle(OperatorPage.state.underCallModal)}
                                        color="primary">
                                        {i18n.t("Under call")}
                                    </Button>
                                    <Modal isOpen={this.state[OperatorPage.state.underCallModal]}>
                                        <ModalHeader className="bg-warning">{i18n.t("Attention")}</ModalHeader>
                                        <ModalBody>{i18n.t("Are you set status to under call, and go next?")}</ModalBody>
                                        <ModalFooter>
                                            <Button 
                                                onClick={this.setUnderCall()}
                                                color="warning">
                                                {i18n.t("Confirm")}
                                            </Button>
                                            <Button
                                                onClick={this.toggle(OperatorPage.state.underCallModal)}
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
                                    <Modal isOpen={this.state[OperatorPage.state.denyModal]}>
                                        <ModalHeader className="bg-warning">{i18n.t("Attention")}</ModalHeader>
                                        <ModalBody>{i18n.t("Are you set status to deny, and go next?")}</ModalBody>
                                        <ModalFooter>
                                            <Button 
                                                onClick={this.setDeny()}
                                                color="warning">
                                                {i18n.t("Confirm")}
                                            </Button>
                                            <Button
                                                onClick={this.toggle(OperatorPage.state.denyModal)}
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
                                            value={moment(order._dt).format("YYYY-MM-DD")}
                                            format={"YYYY-MM-DD"}
                                            mask={"9999-99-99"}
                                            onChange={date => {
                                                if (date) {
                                                    this.change("order._dt")({ 
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
                                    <Modal isOpen={this.state[OperatorPage.state.replaceModal]}>
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
                            let dial = this.getDial(page)();
                            let iCalling = dial.Event !== "Hangup";

                            return (
                                <Panel 
                                    key={page} 
                                    color={filter.page === page ? "primary" : "secondary"}
                                    onClick={() => { 
                                        redirect(null, "index", { page }) 
                                    }}>
                                    {_.get(order, "info.clientInfo.phone")}
                                    
                                    {
                                        iCalling ?
                                        <span className="fa-stack fa-lg pull-right">
                                            <i className="text-secondary fa fa-spinner fa-pulse fa-stack-2x"></i>
                                            <i className="fa fa-phone text-success fa-stack-1x "></i>
                                        </span> :
                                        <span className="fa fa-phone text-danger pull-right fa-lg fa-rotate-90 mt-2 mr-2"></span>
                                    }

                                    <br/>
                                    <small className="text-muted">{_.get(order, "info.clientInfo.fio")}</small>
                                </Panel>
                            )
                        })
                    }

                    <div className="text-right">
                        <Button color="success" onClick={this.addNewOrder()}>
                            <Fa fa="plus" />
                        </Button>
                    </div>
                </Scroll>
            </Layout>
        )
    }
}

export default async (ctx) => {
    let u = await checkAuth(ctx);
    if (u.role === __.ROLES.ADMIN) {
        return ctx.res._render(AdminPage, { user: u });
    }

    let filter = _.cloneDeep(ctx.req.query);
    filter.page = parseInt(ctx.req.query.page || 0);
    let orders = await api("order.getMyOrders", token.get(ctx), {});
    let order = orders[filter.page] || orders[0] || null;

    return ctx.res._render(OperatorPage, { 
        user: u,
        orders,
        order,
        filter
    });
}