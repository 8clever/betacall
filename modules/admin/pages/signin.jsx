import React from "react"
import {
    api,
    token,
    redirect,
    withError,
    I18n,
    Component,
    __
} from "../utils/index.jsx"
import ClientInfo from "../components/ClientInfo.jsx"
import {
    Card,
    Form,
    InputGroup,
    FormGroup,
    Input,
    Button,
    InputGroupAddon,
    InputGroupText
} from "reactstrap"
import {
    Layout,
    Fa
} from "../components/index.jsx";
import { GoogleLogin } from "react-google-login";

export class SignInForm extends Component {
    constructor(props, context) {
        super(props, context);

        this.state = {
            password: "",
            email: ""
        }

        this.submitFrom = this.submitFrom.bind(this);
    }

    handleChange(name) {
        return (e) => {
            this.setState({ [name]: e.target.value });
        }
    }

    async submitFrom(e) {
        e.preventDefault();
        withError(async () => {
            let t = await api("users.login", "public", this.state);
            token.set(t);
            this.redirect()();
        });
    }

    redirect () {
        return () => {
            let _redirect = this.props.redirect || redirect;
            _redirect({}, "index");
        }
    }

    pressEnter() {
        return (e) => {
            if (e.key !== "Enter") return;
            this.submitFrom(e);
        }
    }

    signinGoogle() {
        return (params) => {
            withError(async () => {
                if (params.error)
                    throw new Error(params.error);

                let t = await api("users.loginGoogle", token.get(), {
                    profile: params.profileObj
                });

                token.set(t);
                this.redirect()();
            });
        }
    }

    render() {
        const { i18n } = this.props;
        
        return (
            <Form onKeyUp={this.pressEnter()}>
                <InputGroup className="mb-1">
                    <InputGroupAddon addonType="prepend">
                        <InputGroupText>
                            <i className="fa fa-user"></i>
                        </InputGroupText>
                    </InputGroupAddon>
                    <Input
                        type="text"
                        value={this.state.value}
                        placeholder={ i18n.t("User") }
                        onChange={this.handleChange("email")}
                    />
                </InputGroup>

                <InputGroup>
                    <InputGroupAddon addonType="prepend">
                        <InputGroupText>
                            <i className="fa fa-lock"></i>
                        </InputGroupText>
                    </InputGroupAddon>
                    <Input
                        type="password"
                        value={this.state.password}
                        placeholder={ i18n.t("Password") }
                        onChange={this.handleChange("password")}
                    />
                </InputGroup>

                <FormGroup className="my-5">
                    <Button 
                        className="mb-2"
                        color="primary" 
                        block 
                        onClick={this.submitFrom}>
                        <i className="fa fa-sign-in"></i> Sign-In
                    </Button>
                    {
                        this.props.withGoogle ?
                        <GoogleLogin
                            clientId={__.GOOGLE_CLIENT_ID}
                            responseType={"id_token"}
                            prompt={"consent"}
                            accessType={"offline"}
                            onSuccess={this.signinGoogle()}
                            onFailure={this.signinGoogle()}
                            className="btn btn-danger btn-block">
                                <Fa fa="google"/>
                                {" "}
                                {i18n.t("Login with Google")}
                            </GoogleLogin> : null
                    }
                </FormGroup>

                <FormGroup className="text-center">
                    <a href="#">
                        { i18n.t("Forgot your password?") }
                    </a>
                </FormGroup>
            </Form>
        )
    }
}

SignInForm.defaultProps = {
    i18n: {},
    redirect: null,
    withGoogle: false
}

class SignInLayout extends React.Component {
    render() {
        let i18n = new I18n({});

        return (
            <Layout empty={ true } title="Sign-In">
                <div className="mx-auto">
                    <Card>
                        <Card body>
                            <div className="text-center my-5">
                                <img width="300" src="/call4all.jpg"></img>
                            </div>

                            <ClientInfo />
                            <SignInForm 
                                i18n={i18n}
                            />
                        </Card>
                    </Card>
                </div>
            </Layout>
        )
    }
}

export default async (ctx) => {
    return ctx.res._render(SignInLayout);
}
