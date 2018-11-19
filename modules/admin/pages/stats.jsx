import React from "react";
import { 
    Component, 
    checkAuth, 
    __, 
    api, 
    token, 
    redirect, 
    I18n,
    withError
} from "../utils/index.jsx";
import {
    DatePicker,
    Fa,
    Pagination,
    Layout,
    Scroll
} from "../components/index.jsx"
import _ from "lodash";
import {
    Card,
    CardBody,
    Table,
    Form,
    Label,
    Input,
    Row,
    Col,
    Button,
    Modal,
    ModalHeader,
    ModalBody,
    ModalFooter
} from "reactstrap"
import moment from "moment";
import PropTypes from "prop-types";

const ddFormat = "DD-MM-YYYY";
const DDMMYYYYHHmm = "DD.MM.YYYY HH:mm";

class ViewStats extends Component {

    constructor (props) {
        super(props);
        this.state = {
            orders: {}
        };
    }

    static propTypes () {
        return {
            i18n: PropTypes.object.isRequired,
            visible: PropTypes.bool.isRequired,
            toggle: PropTypes.func.isRequired,
            idOrder: PropTypes.number.isRequired,
            method: PropTypes.string.isRequired
        }
    }

    componentDidUpdate (prevProps) {
        if (this.props.visible && !prevProps.visible) {
            withError(async () => {
                console.log(this.props.method)
                let orders = await api(this.props.method, token.get(), { 
                    sort: { _dt: -1 },
                    lookups: [
                        {
                            as: "_t_user",
                            from: "users",
                            localField: "_iduser",
                            foreignField: "_id"
                        }
                    ],
                    fields: {
                        password: 0,
                        tokens: 0
                    },
                    query: { orderId: this.props.orderId }
                });
                this.setState({
                    orders
                });
            })
        }
    }

    render () {
        let { i18n, visible, toggle, orderId } = this.props;
        let { orders } = this.state;

        if (!visible) return <Modal isOpen={false} />

        return (
            <Modal isOpen={true}>
                <ModalHeader>{i18n.t("Stats for order")} №{orderId}</ModalHeader>
                <ModalBody>

                    <Table>
                        <thead>
                            <tr>
                                <th>{i18n.t("Date")}</th>
                                <th>{i18n.t("User")}</th>
                                <th>{i18n.t("Status")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {
                                _.map(orders.list, (order, idx) => {
                                    return (
                                        <tr key={idx}>
                                            <td>{moment(order._dt).format(DDMMYYYYHHmm)}</td>
                                            <td>{_.get(order, "_t_user.0.name")}</td>
                                            <td>{order.status}</td>
                                        </tr>
                                    )
                                })
                            }
                        </tbody>
                    </Table>
                    
                </ModalBody>
                <ModalFooter>
                    <Button color="light" onClick={toggle}>
                        {i18n.t("Close")}
                    </Button>
                </ModalFooter>
            </Modal>
        )
    }
}

class Default extends Component {
    constructor (props) {
        super(props)
        this.state = {
            filter: props.filter
        };
    }

    UNSAFE_componentWillReceiveProps (props) {
        this.setState({
            filter: props.filter
        });
    }

    search () {
        return () => {
            let { filter } = _.cloneDeep(this.state);
            filter.page = 0;
            redirect(null, "stats", filter);
        }
    }

    onKeyUp () {
        return (e) => {
            if (e.key === "Enter") this.search()();
        }
    }

    render () {
        let { user, stats, limit, users } = this.props;
        let { filter } = this.state;
        let i18n = new I18n(user);
        
        return (
            <Layout title={ i18n.t("Stats") } page="stats" user={user}>
                <Scroll>
                    
                    <Card>
                        <CardBody>
                            <Form onKeyUp={this.onKeyUp()}>
                                <Row form>
                                    <Col md={2}>
                                        <Label>{i18n.t("Order ID")}</Label>
                                        <Input
                                            onChange={this.change("filter.orderId")}
                                            placeholder={i18n.t("Number...")}
                                            value={filter.orderId || ""}
                                        />
                                    </Col>
                                    <Col md={2}>
                                        <Label>{i18n.t("Status")}</Label>
                                        <Input
                                            type="select"
                                            onChange={this.change("filter.status")}
                                            value={filter.status || ""}>
                                            <option value="">{i18n.t("Not Selected")}</option>
                                            {
                                                _.map(__.ORDER_STATUS, (order, idx) => {
                                                    return (
                                                        <option value={order} key={idx}>
                                                            {order}
                                                        </option>
                                                    )
                                                })
                                            }
                                        </Input>
                                    </Col>
                                    <Col md={2}>
                                        <Label>{i18n.t("Date From")}</Label>
                                        <DatePicker 
                                            i18n={i18n}
                                            value={filter.from || ""}
                                            onChange={this.change("filter.from")}
                                        />
                                    </Col>
                                    <Col md={2}>
                                        <Label>{i18n.t("Date To")}</Label>
                                        <DatePicker 
                                            i18n={i18n}
                                            value={filter.to || ""}
                                            onChange={this.change("filter.to")}
                                        />
                                    </Col>
                                    <Col md={2}>
                                        <Label>{i18n.t("User")}</Label>
                                        <Input 
                                            value={filter.user || ""}
                                            onChange={this.change("filter.user")}
                                            type="select">
                                            <option value="">{i18n.t("Not Selected")}</option>
                                            {
                                                _.map(users.list, (user, idx) => {
                                                    return (
                                                        <option 
                                                            value={user._id}
                                                            key={idx}>
                                                            {user.name}: {user.login}
                                                        </option>
                                                    )
                                                })
                                            }
                                        </Input>
                                    </Col>
                                    <Col md={2}>
                                        <Label>&nbsp;</Label>
                                        <br/>
                                        <Button 
                                            onClick={this.search()}
                                            color="primary">
                                            <Fa fa="refresh" />
                                            {" "}
                                            {i18n.t("Search")}
                                        </Button>
                                    </Col>
                                </Row>
                                <div className="mb-2"></div>

                                <Row form>
                                    <Col md={2}>
                                        <Label>{i18n.t("Type of stats")}</Label>

                                        <Input
                                            type="select"
                                            onChange={this.change("filter.type")}
                                            value={filter.type || ""}>
                                            <option value="">{i18n.t("Completed")}</option>
                                            <option value="progress">{i18n.t("In system process")}</option>
                                        </Input>
                                    </Col>
                                </Row>
                            </Form>
                        </CardBody>
                    </Card>
                    <div className="mb-2"></div>

                    <Card>
                        <CardBody>
                            <Table>
                                <thead>
                                    <tr>
                                        <th>{i18n.t("Date")}</th>
                                        <th>{i18n.t("Order ID")}</th>
                                        <th>{i18n.t("User")}</th>
                                        <th>{i18n.t("Status")}</th>
                                        <th>{i18n.t("Next Call")}</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {
                                        _.map(stats.list, (stat, idx) => {
                                            let stateViewStats = "state-view-stats-" + idx;

                                            return (
                                                <tr key={idx}>
                                                    <td>{moment(stat._dt).format(DDMMYYYYHHmm)}</td>
                                                    <td>{stat.orderId}</td>
                                                    <td>{_.get(stat, "_t_user.0.name")}</td>
                                                    <td>{stat.status}</td>
                                                    <td>
                                                        {
                                                            stat._dtnextCall ?
                                                            moment(stat._dtnextCall).format(DDMMYYYYHHmm)
                                                            : null
                                                        }
                                                    </td>
                                                    <td className="text-right">
                                                        <Button 
                                                            onClick={this.toggle(stateViewStats)}
                                                            outline
                                                            size="sm"
                                                            color="primary">
                                                            <Fa fa="eye" />    
                                                        </Button>
                                                        <ViewStats 
                                                            i18n={i18n}
                                                            method={this.props.methodStats}
                                                            orderId={stat.orderId}
                                                            visible={!!this.state[stateViewStats]}
                                                            toggle={this.toggle(stateViewStats)}
                                                        />
                                                    </td>
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
                        location="stats"
                        count={ stats.count }
                        filter={ filter }
                    />
                </Scroll>
            </Layout>
        )
    }
}

export default async (ctx) => {
    let user = await checkAuth(ctx, __.PERMISSION.STATS.VIEW);
    let query = {};
    let limit = 20;
    let filter = _.cloneDeep(ctx.req.query);
    let methodStats = "order.getStatsAll";

    filter.page = parseInt(filter.page || 0);
    filter.from = filter.from || moment().format(ddFormat);
    filter.to = filter.to || moment().format(ddFormat);

    if (filter.user) {
        query._iduser = filter.user
    }

    if (filter.from) {
        query._dt = query._dt || {};
        query._dt.$gte = moment(filter.from, ddFormat).startOf("day").toDate()
    }

    if (filter.to) {
        query._dt = query._dt || {};
        query._dt.$lte = moment(filter.to, ddFormat).endOf("day").toDate()
    }

    if (filter.orderId) {
        query.orderId = parseInt(filter.orderId);
    }

    if (filter.status) {
        query.status = filter.status;
    }

    if (filter.type === "progress") {
        methodStats = "order.getStats";
    }

    let [ stats, users ] = await Promise.all([
        api(methodStats, token.get(ctx), {
            aggregate: [
                { $match: query },
                { $lookup: {
                    as: "_t_user",
                    from: "users",
                    localField: "_iduser",
                    foreignField: "_id"
                }},
                { $group: {
                    _id: "$orderId",
                    _dt: { $first: "$_dt" },
                    _dtnextCall: { $last: "$_dtnextCall" },
                    status: { $last: "$status" },
                    _t_user: { $last: "$_t_user" }
                }},
                { $addFields: {
                    orderId: "$_id"
                }}
            ],
            limit,
            skip: filter.page * limit,
            sort: {
                _dt: -1
            }
        }),
        api("users.getUsers", token.get(ctx), {
            query: {},
            fields: {
                login: 1,
                name: 1
            }
        })
    ]);

    return ctx.res._render(Default, {
        methodStats,
        user,
        users,
        stats,
        filter,
        limit
    });
}