import React from "react";
import {
    Layout,
    Scroll,
    Panel
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
    Button
} from "reactstrap";

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



class UserPage extends Component {
    constructor (props) {
        super(props);
        this.state = {};
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
        const i18n = new I18n(user);

        return (
            <Layout title={ i18n.t("Home") } page="home" user={user}>
                <Scroll>
                    <Button 
                        size="lg"
                        color="success"
                        className="mx-auto"
                        onClick={this.call()}>
                        {i18n.t("Start")}
                    </Button>
                </Scroll>
                <Scroll className="col-sm-3 w-100">
                    <Panel color="secondary">
                        89066482837
                        <br/>
                        <small className="text-muted">Ivan Vityaev</small>
                    </Panel>
                    <Panel color="secondary">
                        89066482837
                        <br/>
                        <small className="text-muted">Ivan Vityaev</small>
                    </Panel>
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

    return ctx.res._render(UserPage, { 
        user: u
    });
}