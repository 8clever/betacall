import React from "react";
import { 
    Component, 
    checkAuth, 
    __, 
    api, 
    token, 
    redirect, 
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

} from "reactstrap"

class Default extends Component {
    constructor (props) {
        super(props)
        this.state = {};
    }

    render () {
        let { filter, user } = this.props;
        let i18n = new I18n(user);
        
        return (
            <Layout title={ i18n.t("Default") } page="default" user={user}>
                <Scroll>
                    
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
    let user = await checkAuth(ctx, __.PERMISSION.DEFAULT.VIEW);

    return ctx.res._render(Default, {
        user,
        filter: ctx.req.query
    });
}