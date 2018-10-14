
import Reflux from 'reflux'
import Actions from './actions.jsx'

export default class Redirect extends Reflux.Store {
    constructor () {
        super()
        this.state = {
            stateAlertRedirect: false
        };

        [
            "redirectFromAlert",
            "disableRedirect",
            "enableRedirect",
            "showRedirectAlert",
            "hideRedirectAlert"
        ].forEach(evt => {
            this.listenTo(Actions[evt], this[evt]);
        });
    }

    disableRedirect () {
        global.disableRedirects = true;
    }

    enableRedirect () {
        global.disableRedirects = false;
        this.setState({ 
            disableRedirects: false,
            stateRedirectFn: false
        });
    }

    showRedirectAlert (redirect) {
        this.setState({ 
            stateAlertRedirect: true,
            stateRedirectFn: redirect
        });
    }

    redirectFromAlert () {
        this.hideRedirectAlert();
        this.state.stateRedirectFn();
        this.enableRedirect();
    }

    hideRedirectAlert () {
        this.setState({ stateAlertRedirect: false });
    }
}