import { Alert } from "reactstrap";
import { Component } from "reflux";
import React from "react";
import InfoStore from "../store/InfoStore.jsx";
import Actions from "../store/actions.jsx";

class Info extends Component {
    constructor(props, context) {
        super(props);
        this.onDismiss = this.onDismiss.bind(this);
    }

    onDismiss() {
        Actions.hideInfo(this.props.idx);
    }

    render() {
        let { message = {}} = this.props;

        return (
            <Alert color={ message.color || "danger" } isOpen={ message.visible } toggle={ this.onDismiss }>
                { 
                    message.subject ? 
                    <span>
                        <b>
                            { message.subject }
                        </b>
                        <br/>
                    </span>
                    :
                    "" 
                }
                { message.message }
            </Alert>
        );
    }
}

class InfoBody extends Component {
    constructor() {
        super()
        this.store = InfoStore;
    }

    render () {
        let { infos } = this.state
        return (
            <div style={{ zIndex: 10000 }}>
                { 
                    infos.map((info, idx) => (
                        <Info key={ idx } idx={ idx } message={ info } />
                    ))
                }
            </div>
        )
    }
}

export default InfoBody;