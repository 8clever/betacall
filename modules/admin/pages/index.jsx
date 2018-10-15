import React from "react";
import {
    Layout,
    Scroll,
    DatePicker,
    TimePicker,
    Fa
} from "../components/index.jsx"
import { 
    Socket,
    checkAuth, 
    I18n, 
    __,
    withError,
    api,
    token,
    Component
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
            order: props.order,
            dial: {
                Event: "Hangup"
            }
        };
    }

    componentDidMount () {
        let { user } = this.props;
        this.socket = Socket.connect();
        this.socket.on(user._id + "-dial", (evt) => {
            this.setState({ dial: evt });
        });
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

    render() {
        let { user } = this.props;
        let { order, dial } = this.state;
        const i18n = new I18n(user);

        return (
            <Layout title={ i18n.t("Home") } page="home" user={user}>
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
                                            value={this.get(order, "info.deliveryDate", "")}
                                            onChange={this.change("order.info.deliveryDate")}
                                            format="YYYY-MM-DD"
                                            mask={"9999-99-99"}
                                        />
                                    </FormGroup>

                                    <FormGroup>
                                        <Label>{i18n.t("Time from")}</Label>
                                        <TimePicker
                                            value={this.get(order, "info.deliveryTimeFrom", "")}
                                            onChange={this.change("order.info.deliveryTimeFrom")}
                                        />
                                    </FormGroup>

                                    <FormGroup>
                                        <Label>{i18n.t("Time to")}</Label>
                                        <TimePicker
                                            value={this.get(order, "info.deliveryTimeTo", "")}
                                            onChange={this.change("order.info.deliveryTimeTo")}
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
                                                <th>{i18n.t("№ Order")}</th>
                                                <th>{i18n.t("Bar Code")}</th>
                                                <th>{i18n.t("№ Order in market")}</th>
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

                            <Card>
                                <CardBody>
                                    <CardTitle>
                                        {i18n.t("Dial")}
                                        {" "}
                                        <small className="text-muted">{this.get(dial, 'Event')}</small>
                                    </CardTitle>
                                    <Button 
                                        disabled={this.get(dial, "Event") !== "Hangup"}
                                        onClick={this.beginCall()}
                                        color="success">
                                        {i18n.t("Begin Call")} <Fa fa="phone"/>
                                    </Button>
                                </CardBody>
                            </Card>
                            <div className="mb-2"></div>

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
            </Layout>
        )
    }
}

export default async (ctx) => {
    let u = await checkAuth(ctx);
    if (u.role === __.ROLES.ADMIN) {
        return ctx.res._render(AdminPage, { user: u });
    }

    let order = await api("order.getMyOrder", token.get(ctx), {});
    return ctx.res._render(OperatorPage, { 
        user: u,
        order
    });
}