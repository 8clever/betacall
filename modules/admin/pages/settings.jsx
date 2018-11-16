import React from "react";
import { 
    Component, 
    checkAuth, 
    __, 
    api, 
    token, 
    withError, 
    I18n
} from "../utils/index.jsx";
import {
    Fa,
    Pagination,
    Layout,
    Scroll
} from "../components/index.jsx"
import _ from "lodash";
import {
    Label,
    Card,
    CardHeader,
    CardBody,
    FormGroup,
    Row,
    Col,
    Button,
    Modal,
    ModalBody,
    ModalHeader,
    ModalFooter,
    Input
} from "reactstrap"
import TimePicker from "../components/TimePicker.jsx";
import moment from "moment";
import PropTypes from "prop-types";

class EditTimeCall extends Component {
    constructor(props) {
        super(props)
        this.state = {};
    }

    componentDidUpdate (prevProps, prevState) {
        if (
            !prevProps.visible &&
            this.props.visible
        ) {
            this.setState({
                timeCall: _.cloneDeep(this.props.timeCall || EditTimeCall.defaultProps.timeCall)
            });
        }
    }

    static get defaultProps () {
        return {
            timeCall: {
                region: "",
                _i_start: 9,
                _i_end: 21
            }
        }
    }

    static get propTypes () {
        return {
            i18n: PropTypes.object.isRequired,
            visible: PropTypes.bool.isRequired,
            toggle: PropTypes.func.isRequired,
            onSave: PropTypes.func.isRequired,
            onCancel: PropTypes.func.isRequired,
            timeCall: PropTypes.object
        }
    }

    save () {
        return () => {
            withError(async () => {
                let { timeCall } = _.cloneDeep(this.state);
                let settings = await api("settings.getSettings", token.get(), {});

                let region = _.find(settings.timeCalls, _.matches({ region: timeCall.region }));
                if (region) _.assign(region, timeCall);
                else settings.timeCalls.push(timeCall);

                await api("settings.editSettings", token.get(), { data: settings });
                this.props.onSave();
                this.props.toggle();
            })
        }
    }

    cancel () {
        return () => {
            this.props.onCancel();
            this.props.toggle();
        }
    }

    render () {
        if (!(
            this.props.visible &&
            this.state.timeCall
        )) return <Modal isOpen={false} />

        let { i18n } = this.props;
        let { timeCall } = this.state;

        return (
            <Modal isOpen={true}>
                <ModalHeader>{ i18n.t("Edit Time Call") }</ModalHeader>
                <ModalBody>
                    <FormGroup>
                        <Label>{i18n.t("Region")}</Label>
                        <Input
                            onChange={this.change("timeCall.region")}
                            value={timeCall.region || ""}
                            placeholder={i18n.t("Text...")}
                        />
                    </FormGroup>

                    <FormGroup>
                        <Label>{i18n.t("Start Calls")}</Label>
                        <TimePicker
                            onChange={this.change(`timeCall._i_start`)}
                            format="HH"
                            mask="99"
                            value={moment().startOf("day").add(timeCall._i_start, "hours").format("HH")}
                        />
                    </FormGroup>

                    <FormGroup>
                        <Label>{i18n.t("End Calls")}</Label>
                        <TimePicker
                            onChange={this.change(`timeCall._i_end`)}
                            format="HH"
                            mask="99"
                            value={moment().startOf("day").add(timeCall._i_end, "hours").format("HH")}
                        />
                    </FormGroup>
                </ModalBody>
                <ModalFooter>
                    <Button 
                        color="primary" 
                        onClick={this.save()}>
                        {i18n.t("Save")}
                    </Button>
                    <Button 
                        onClick={this.cancel()}
                        color="light">
                        {i18n.t("Cancel")}
                    </Button>
                </ModalFooter>
            </Modal>
        )
    }
}

class Settings extends Component {
    constructor (props) {
        super(props)
        this.state = {
            settings: props.settings
        };
    }

    UNSAFE_componentWillReceiveProps (props) {
        this.setState({
            settings: props.settings
        });
    }

    rmTimeCall (idx, toggle) {
        return () => {
            withError(async () => {
                let { settings } = _.cloneDeep(this.state);
                delete settings.timeCalls[idx];
                settings.timeCalls = _.compact(settings.timeCalls);
                api("settings.editSettings", token.get(), { data: settings });
                global.router.reload();
                toggle();
            });
        }
    }

    render () {
        let { filter, user, settings } = this.props;
        let i18n = new I18n(user);
    
        const stateAddTimeCall = "add-time-call";

        return (
            <Layout title={ i18n.t("Settings") } page="settings" user={user}>
                <Scroll>

                    <Card>
                        <CardHeader>
                            <Row>
                                <Col>
                                    {i18n.t("Time Calls")}
                                </Col>
                                <Col className="text-right">
                                    <Button 
                                        onClick={this.toggle(stateAddTimeCall)}
                                        color="success" 
                                        size="sm">
                                        <Fa fa="plus" />
                                    </Button>

                                    <EditTimeCall 
                                        onSave={() => global.router.reload()}
                                        onCancel={() => {}}
                                        toggle={this.toggle(stateAddTimeCall)}
                                        visible={!!this.state[stateAddTimeCall]}
                                        i18n={i18n}
                                    />
                                </Col>
                            </Row>
                        </CardHeader>
                        <CardBody>
                            <Row>
                                {
                                    _.map(settings.timeCalls, (timeCall, idx) => {
                                        const stateEditTimeCall = "edit-time-call-" + idx;
                                        const stateRmTimeCall = "rm-time-call-" + idx;
                                        
                                        return (
                                            <Col md={6} key={idx}>
                                                <Row form className="mb-2">
                                                    <Col>
                                                        {timeCall.region} {timeCall._i_start}:00 - {timeCall._i_end}:00 
                                                    </Col>
                                                    <Col className="text-right">
                                                        <Button 
                                                            onClick={this.toggle(stateEditTimeCall)}
                                                            outline
                                                            size="sm"
                                                            color="primary">
                                                            <Fa fa="pencil" />
                                                        </Button>
                                                        <EditTimeCall 
                                                            onSave={() => global.router.reload()}
                                                            onCancel={() => {}}
                                                            visible={!!this.state[stateEditTimeCall]}
                                                            toggle={this.toggle(stateEditTimeCall)}
                                                            timeCall={timeCall}
                                                            i18n={i18n}
                                                        />
                                                        {" "}
                                                        <Button
                                                            onClick={this.toggle(stateRmTimeCall)}
                                                            color="danger"
                                                            size="sm"
                                                            outline>
                                                            <Fa fa="trash" />
                                                        </Button>
                                                        <Modal isOpen={!!this.state[stateRmTimeCall]}>
                                                            <ModalHeader className="bg-warning">
                                                                {i18n.t("Attention!")}
                                                            </ModalHeader>
                                                            <ModalBody>
                                                                {i18n.t("Are you sure remove region?")}
                                                            </ModalBody>
                                                            <ModalFooter>
                                                                <Button
                                                                    onClick={this.rmTimeCall(idx, this.toggle(stateRmTimeCall))}
                                                                    color="warning">{i18n.t("Confirm")}</Button>
                                                                <Button 
                                                                    color="light"
                                                                    onClick={this.toggle(stateRmTimeCall)}>
                                                                    {i18n.t("Cancel")}
                                                                </Button>
                                                            </ModalFooter>
                                                        </Modal>
                                                    </Col>
                                                </Row>
                                            </Col>
                                        )
                                    })
                                }
                            </Row>
                            
                        </CardBody>
                    </Card>
                    

                    <Pagination 
                        location="default"
                        count={ 0 }
                        filter={ filter }
                    />
                </Scroll>
            </Layout>
        )
    }
}

export default async (ctx) => {
    let user = await checkAuth(ctx, __.PERMISSION.SETTINGS.VIEW);
    let settings = await api("settings.getSettings", token.get(ctx), {});

    return ctx.res._render(Settings, {
        user,
        settings,
        filter: ctx.req.query
    });
}