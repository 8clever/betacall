
import Reflux from 'reflux'
import Actions from './actions.jsx'

export default class ProgressStore extends Reflux.Store {
    constructor () {
        super()
        this.state = {
            isLoading: false,
            progress: 0
        }
        this.listenTo(Actions.loading, this.loading)
        this.listenTo(Actions.stopLoading, this.stopLoading)
        this.listenTo(Actions.progress, this.progress)
    }

    loading () {
        if (!global.isBrowser) return;
        this.setState({ isLoading: true })
    }
    
    stopLoading () {
        if (!global.isBrowser) return;
        this.setState({ isLoading: false })
    }

    progress ({ progress }) {
        if (!global.isBrowser) return;
        this.setState({ progress });
    }
}