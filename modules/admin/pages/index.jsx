import React from "react";
import {
    Layout,
    Scroll,
    DatePicker,
    TimePicker
} from "../components/index.jsx"
import { 
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
    Button
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

    render() {
        let { user } = this.props;
        let { order } = this.state;
        const i18n = new I18n(user);

        console.log(order);

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
                                            value={_.get(order, "info.clientInfo.fio", "")}
                                            onChange={this.change("order.info.clientInfo.fio")}
                                        />
                                    </FormGroup>

                                    <FormGroup>
                                        <Label>{i18n.t("Phone")}</Label>
                                        <Input
                                            value={_.get(order, "info.clientInfo.phone")}
                                            onChange={this.change("order.info.clientInfo.phone")}
                                        />
                                    </FormGroup>

                                    <FormGroup>
                                        <Label>{i18n.t("E-mail")}</Label>
                                        <Input
                                            value={_.get(order, "info.clientInfo.email")}
                                            onChange={this.change("order.info.clientInfo.email")}
                                        />
                                    </FormGroup>

                                    <FormGroup>
                                        <Label>{i18n.t("Comment")}</Label>
                                        <Input
                                            type="textarea"
                                            value={_.get(order, "info.clientInfo.comment")}
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
                                            value={_.get(order, "info.deliveryDate", "")}
                                            onChange={this.change("order.info.deliveryDate")}
                                            format="YYYY-MM-DD"
                                            mask={"9999-99-99"}
                                        />
                                    </FormGroup>

                                    <FormGroup>
                                        <Label>{i18n.t("Time from")}</Label>
                                        <TimePicker
                                            value={_.get(order, "info.deliveryTimeFrom", "")}
                                            onChange={this.change("order.info.deliveryTimeFrom")}
                                        />
                                    </FormGroup>

                                    <FormGroup>
                                        <Label>{i18n.t("Time to")}</Label>
                                        <TimePicker
                                            value={_.get(order, "info.deliveryTimeTo", "")}
                                            onChange={this.change("order.info.deliveryTimeTo")}
                                        />
                                    </FormGroup>

                                    <FormGroup>
                                        <Label>{i18n.t("Delivery Region")}</Label>
                                        <Input
                                            value={_.get(order, "info.deliveryAddress.region")}
                                            onChange={this.change("info.deliveryAddress.region")}
                                        />
                                    </FormGroup>

                                    <FormGroup>
                                        <Label>{i18n.t("Delivery City")}</Label>
                                        <Input
                                            value={_.get(order, "info.deliveryAddress.city")}
                                            onChange={this.change("info.deliveryAddress.city")}
                                        />
                                    </FormGroup>

                                    <FormGroup>
                                        <Label>{i18n.t("Zip Code")}</Label>
                                        <Input
                                            value={_.get(order, "info.deliveryAddress.zipcode")}
                                            onChange={this.change("info.deliveryAddress.zipcode")}
                                        />
                                    </FormGroup>

                                    <FormGroup>
                                        <Label>{i18n.t("Delivery Address")}</Label>
                                        <Input
                                            value={_.get(order, "info.deliveryAddress.inCityAddress.address")}
                                            onChange={this.change("info.deliveryAddress.inCityAddress.address")}
                                        />
                                    </FormGroup>

                                    <FormGroup check>
                                        <Label check>
                                            <Input 
                                                type="radio" 
                                                name="delivery-type"
                                                checked={_.get(order, "info.deliveryType") === __.DELIVERY_TYPE.COURIER}
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
                                                checked={_.get(order, "info.deliveryType") === __.DELIVERY_TYPE.PICKUP}
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
                                        _.get(order, "info.deliveryType") === __.DELIVERY_TYPE.PICKUP ?
                                        <FormGroup>
                                            <Label>{i18n.t("Pickup address")}</Label>
                                            <Input
                                                value={_.get(order, "info.deliveryAddress.pickupAddress") || ""}
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
                                                <th>{i18n.t("Bar COde")}</th>
                                                <th>{i18n.t("№ Order in market")}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td>{_.get(order, "info.orderIdentity.orderId")}</td>
                                                <td>{_.get(order, "info.orderIdentity.barcode")}</td>
                                                <td>{_.get(order, "info.orderIdentity.webshopNumber")}</td>
                                            </tr>
                                        </tbody>
                                    </Table>

                                    <FormGroup>
                                        <b>{i18n.t("status")}:</b> {_.get(order, "info.status.name")}
                                        <br/>
                                        <b>{i18n.t("work status")}:</b> {_.get(order, "info.workStatus.name")}
                                    </FormGroup>

                                    <FormGroup>
                                        <Label>{i18n.t("End of storage date")}</Label>
                                        <DatePicker
                                            value={_.get(order, "info.endOfStorageDate", "")}
                                            onChange={this.change("order.info.endOfStorageDate")}
                                            format="YYYY-MM-DD"
                                            mask="9999-99-99"
                                        />
                                    </FormGroup>

                                    <b>{i18n.t("Full order price")}:</b> {_.get(order, "info.clientFullCost")} p.
                                </CardBody>
                            </Card>
                            <div className="mb-2"></div>

                            <Card>
                                <CardBody>
                                    <CardTitle>
                                        {i18n.t("Actions")}
                                    </CardTitle>

                                    <Button color="success">
                                        {i18n.t("Done")}
                                    </Button>
                                    {" "}
                                    <Button color="primary">
                                        {i18n.t("Under call")}
                                    </Button>
                                    {" "}
                                    <Button color="danger">
                                        {i18n.t("Deny")}
                                    </Button>
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
                                        color="warning">
                                        {i18n.t("Replace")}
                                    </Button>
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