import { redirect, __ } from "../utils/index.jsx";
import React from "react";
import Empty from "../components/Empty.jsx";
import _ from "lodash";

class Error extends React.Component {
    render () {
        return (
            <Empty>
                <div className="w-100 text-center">
                    { _.get(this, "props.err.message", "Generic Error") }
                    <br />
                    <a href={ __.PREFIX_ADMIN + "/" }>Home</a> | <a href={ __.PREFIX_ADMIN + "/signin" }>Sign-In</a>
                </div>
            </Empty>
        )
    }
}

export default (err, req, res, next) => {
    if (err && err.subject === __.ERROR.SUBJECT.UNAUTHORIZED) {
        redirect({ req, res }, "signin");
    } 

    console.log(err);
    res._render(Error, { err });
}