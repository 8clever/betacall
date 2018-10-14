
import Reflux from 'reflux'
import Actions from './actions.jsx'

export default class MenuStore extends Reflux.Store {
    constructor() {
        super()
        this.state = {}
        this.listenTo(Actions.toggleMenu, this.toggleMenu);
    }

    toggleMenu(name) {
        this.setState({
            [name]: !this.state[name]
        });
    }
}