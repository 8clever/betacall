import { Alert } from "reactstrap";
import * as __info from "../store/InfoStore.jsx";
import * as React from "react";
import { observer } from "mobx-react-lite";

const Info = props => {
    let { message = {}, idx } = props;

    function onDismiss () {
        __info.actions.hideInfo(idx);
    }

    return <Alert color={ message.color || "danger" } isOpen={ message.visible } toggle={ onDismiss }>
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
}

const InfoBody = observer(() => <div style={{ zIndex: 10000 }}>
    { 
        __info.store.infos.map((info, idx) => (
            <Info key={ idx } idx={ idx } message={ info } />
        ))
    }
</div>)

export default InfoBody;