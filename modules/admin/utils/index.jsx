import token from "./token.jsx"
import api from "./api.jsx"
import checkAuth from "./checkAuth.jsx"
import redirect from "./redirect.jsx"
import withError from "./withError.jsx"
import uploadFile from "./uploadFile.jsx"
import validateInput from "./validateInput.jsx"
import I18n from "./i18n.jsx";
import cookies from "./cookies.jsx";
import React from "react";
import { FormText } from 'reactstrap';
import _ from "lodash";
import __ from "../../api/__namespace";
import Socket from "./socket.jsx";

class Component extends React.Component {
    constructor (props) {
        super(props);
        this.state = {};
    }

    toggle (name) {
        return () => {
            this.change(name)({
                target: {
                    value: !_.get(this.state, name)
                }
            });
        }
    }

    change (field, options) {
		return (e) => {
            e.target.value = validateInput(e.target.value, options);
			let state = _.cloneDeep(this.state);
			_.set(state, field, e.target.value);
			this.setState(state);
		}
	}

    changeDate (field) {
        return date => {
            let value = date && date.toDate && date.toDate();
            this.change(field)({ target: { value }});
        }
    }
    
    getError (property) {
		return () => {
			let { error } = _.cloneDeep(this.state);
			let data = _.find(error, _.matchesProperty("property", property));
			if (data) data.invalid = true
			else {
				data = { invalid: false }
            }
			if (!data.invalid) return null;
			return <FormText color="danger">{data.message}</FormText>
		}
    }
}

function imgUrl (_idimage, width = "", height = "") {
    if (!_idimage) throw new Error("_id of image is required");
    return `/file/img/${_idimage}?w=${width}&h=${height}`;
}

function fileUrl (_idfile) {
    if (!_idfile) throw new Error("_id of file is required");
    return `/file/file/${_idfile}`
}

function downloadFileUrl (filename) {
    if (!filename) throw new Error("filename is required");
    return `/download-file/${filename}`
}

export {
    Socket,
    __,
    imgUrl,
    fileUrl,
    downloadFileUrl,
    Component,
    I18n,
    validateInput,
    token, 
    api, 
    checkAuth, 
    redirect,
    withError, 
    uploadFile,
    cookies
};