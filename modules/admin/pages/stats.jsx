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
import url from "url";

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
            idOrder: PropTypes.number.isRequired
        }
    }

    componentDidUpdate (prevProps) {
        if (this.props.visible && !prevProps.visible) {
            withError(async () => {
                const query = { orderId: this.props.orderId };
                await api("order.prepareJoinStats", token.get(), { query });
                let orders = await api("order.getJoinStats", token.get(), { 
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
                    query
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

const Stats = props => {
    const { user, stats, limit, users } = props;
    const i18n = new I18n(user);
    const [ stateFilter, setFilter ] = React.useState(props.filter);
    const [ stateToggle, setToggle ] = React.useState({});
    
    let filter = Object.assign({}, stateFilter);
    let toggle = Object.assign({}, stateToggle);

    React.useEffect(() => {
        setFilter(props.filter)
    }, [props.filter]);

    const search = () => {
        filter.page = 0;
        redirect(null, "stats", filter);
    }

    const onKeyUp = e => {
        if (e.key === "Enter") search();
    }

    const downloadXlsxByRegion = () => {
        window.location = url.format({
            pathname: "/excel/getStatsByRegion",
            query: stateFilter
        });
    }

    const downloadXlsxByDays = () => {
        window.location = url.format({
            pathname: "/excel/getStatsByDay",
            query: stateFilter
        });
    }

    const downloadXlsxIndicators = () => {
        window.location = url.format({
            pathname: "/excel/getIndicators",
            query: stateFilter
        });
    }

    const downloadXlsx = () => {
        window.location = url.format({
            pathname: "/excel/getStats",
            query: stateFilter
        });
    }

    return (
        <Layout title={ i18n.t("Stats") } page="stats" user={user}>
            <Scroll>
                <Card>
                    <CardBody>
                        <Form onKeyUp={onKeyUp}>
                            <Row form>
                                <Col md={2}>
                                    <Label>{i18n.t("Order ID")}</Label>
                                    <Input
                                        onChange={e => {
                                            filter.orderId = e.target.value;
                                            setFilter(filter);
                                        }}
                                        placeholder={i18n.t("Number...")}
                                        value={filter.orderId || ""}
                                    />
                                </Col>
                                <Col md={2}>
                                    <Label>{i18n.t("Status")}</Label>
                                    <Input
                                        type="select"
                                        onChange={e => {
                                            filter.status = e.target.value;
                                            setFilter(filter);
                                        }}
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
                                        onChange={e => {
                                            filter.from = e.target.value;
                                            setFilter(filter);
                                        }}
                                    />
                                </Col>
                                <Col md={2}>
                                    <Label>{i18n.t("Date To")}</Label>
                                    <DatePicker 
                                        i18n={i18n}
                                        value={filter.to || ""}
                                        onChange={e => {
                                            filter.to = e.target.value;
                                            setFilter(filter);
                                        }}
                                    />
                                </Col>
                                <Col md={2}>
                                    <Label>{i18n.t("User")}</Label>
                                    <Input 
                                        value={filter.user || ""}
                                        onChange={e => {
                                            filter.user = e.target.value;
                                            setFilter(filter);
                                        }}
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
                                    <Label>{i18n.t("Market Name")}</Label>
                                    <Input 
                                        placeholder="Text..."
                                        onChange={e => {
                                            filter.marketName = e.target.value;
                                            setFilter(filter)
                                        }}
                                        value={filter.marketName || ""}
                                    />
                                </Col>
                                <Col md={12}>
                                    <Label>&nbsp;</Label>
                                    <br/>
                                    <Button 
                                        onClick={search}
                                        color="primary">
                                        <Fa fa="refresh" />
                                        {" "}
                                        {i18n.t("Search")}
                                    </Button>{" "}
                                    <Button 
                                        onClick={downloadXlsx}
                                        color="light">
                                        <Fa fa="file-o"/> {"Excel"}
                                    </Button>{" "}
                                    <Button 
                                        onClick={downloadXlsxByRegion}
                                        color="light">
                                        <Fa fa="file-o"/> {"Excel by Region"}
                                    </Button>{" "}
                                    <Button 
                                        onClick={downloadXlsxByDays}
                                        color="light">
                                        <Fa fa="file-o"/> {"Excel by Days"}
                                    </Button>{" "}
                                    <Button
                                        onClick={downloadXlsxIndicators}
                                        color="light">
                                        <Fa fa="file-o"/> {"Excel Indicators"}
                                    </Button>
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
                                    <th>{i18n.t("Market Name")}</th>
                                    <th>{i18n.t("Status")}</th>
                                    <th>{i18n.t("Region")}</th>
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
                                                <td>{_.get(stat, "_s_marketName")}</td>
                                                <td>{stat.status}</td>
                                                <td>{stat._s_region}</td>
                                                <td>
                                                    {
                                                        stat._dtnextCall ?
                                                        moment(stat._dtnextCall).format(DDMMYYYYHHmm)
                                                        : null
                                                    }
                                                </td>
                                                <td className="text-right">
                                                    <Button 
                                                        onClick={() => {
                                                            toggle[stateViewStats] = !toggle[stateViewStats];
                                                            setToggle(toggle);
                                                        }}
                                                        outline
                                                        size="sm"
                                                        color="primary">
                                                        <Fa fa="eye" />    
                                                    </Button>
                                                    <ViewStats 
                                                        i18n={i18n}
                                                        orderId={stat.orderId}
                                                        visible={!!toggle[stateViewStats]}
                                                        toggle={() => {
                                                          toggle[stateViewStats] = !toggle[stateViewStats];
                                                          setToggle(toggle);  
                                                        }}
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

export default async (ctx) => {
    let user = await checkAuth(ctx, __.PERMISSION.STATS.VIEW);
    let query = {};
    let query2 = {};
    let limit = 20;
    let filter = _.cloneDeep(ctx.req.query);

    filter.page = parseInt(filter.page || 0);
    filter.from = filter.from || moment().format(ddFormat);
    filter.to = filter.to || moment().format(ddFormat);

    // query 1
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

    if (filter.marketName) {
        query._s_marketName = { $regex: filter.marketName, $options: "gmi" }
    }

    if (filter.deliveryType) {
        query._s_deliveryType = filter.deliveryType;
    }

    // query 2
    if (filter.status) {
        query2.status = filter.status;
    }

    await api("order.prepareJoinStats", token.get(ctx), { query });
    let [ stats, users ] = await Promise.all([
        api("order.getJoinStats", token.get(ctx), {
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
                    _t_user: { $last: "$_t_user" },
                    _s_marketName: { $last: "$_s_marketName" },
                    _s_region: { $last: "$_s_region" }
                }},
                { $match: query2 },
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

    return ctx.res._render(Stats, {
        user,
        users,
        stats,
        filter,
        limit
    });
}