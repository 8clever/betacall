
import Reflux from 'reflux'
import Actions from './actions.jsx'

export default class InfoStore extends Reflux.Store {
    constructor () {
        super()
        this.state = {
            infos: []
        }
        this._n = 0;
        this.listenTo(Actions.addInfo, this.addInfo)
        this.listenTo(Actions.hideInfo, this.hideInfo)
    }

    addInfo (info) {
        this._n ++;
        info.visible = true;
        info.id = this._n; 
        let infos = this.state.infos.concat([]);
        infos.push(info);
        this.setState({ infos });

        setTimeout(() => {
            this.hideInfoById(info.id);
        }, 10000);
    }

    hideInfoById (id) {
        let infos = this.state.infos.concat([]);
        infos.forEach((i,idx) => {
            if (id === i.id) {
                this.hideInfo(idx);
            }
        });
    }
    
    hideInfo (idx) {
        let infos = this.state.infos.concat([]);
        infos[idx].visible = false;
        this.setState({ infos })
    }
}