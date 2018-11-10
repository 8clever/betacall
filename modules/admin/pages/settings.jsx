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
    Button
} from "reactstrap"
import TimePicker from "../components/TimePicker.jsx";
import moment from "moment";

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

    save () {
        return () => {
            withError(async () => {
                let { settings } = _.cloneDeep(this.state);
                await api("settings.editSettings", token.get(), { data: settings });
            });
        }
    }

    render () {
        let { filter, user, settings } = this.props;
        let i18n = new I18n(user);
        
        return (
            <Layout title={ i18n.t("Default") } page="default" user={user}>
                <Scroll>

                    <Card>
                        <CardBody className="text-right">
                            <Button onClick={this.save()} color="primary">
                                {i18n.t("Save")}
                            </Button>
                        </CardBody>
                    </Card>
                    <div className="mb-2"></div>

                    <Card>
                        <CardHeader>{i18n.t("Time Calls")}</CardHeader>
                        <CardBody>
                            {
                                _.map(settings.timeCalls, (timeCall, idx) => {
                                    
                                    return (
                                        <div key={idx}>
                                            <h2>{timeCall.region}</h2>
                                            <Row form>
                                                <Col md={6}>
                                                    <FormGroup>
                                                        <Label>{i18n.t("Start Calls")}</Label>
                                                        <TimePicker
                                                            onChange={this.change(`settings.timeCalls.${idx}._i_start`)}
                                                            format="HH"
                                                            mask="99"
                                                            value={moment().startOf("day").add(timeCall._i_start, "hours").format("HH")}
                                                        />
                                                    </FormGroup>
                                                </Col>
                                                <Col md={6}>
                                                    <FormGroup>
                                                        <Label>{i18n.t("End Calls")}</Label>
                                                        <TimePicker
                                                            onChange={this.change(`settings.timeCalls.${idx}._i_end`)}
                                                            format="HH"
                                                            mask="99"
                                                            value={moment().startOf("day").add(timeCall._i_end, "hours").format("HH")}
                                                        />
                                                    </FormGroup>
                                                </Col>
                                            </Row>
                                        </div>
                                    )
                                })
                            }
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