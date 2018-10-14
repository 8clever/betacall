import ProgressStore from "../store/Progress.jsx"
import Actions from "../store/actions.jsx"
import Reflux from "reflux"
import React from "react"

class Progress extends Reflux.Component {
    constructor(props) {
        super(props);
        this.store = ProgressStore
    }

    render() {
        let { color = "red", height = 5 } = this.props;
        let { progress, isLoading } = this.state;

        if (isLoading) {
            setTimeout(() => {
                let tt = (100 - progress) * 0.95;
                let nowProgress = 100 - tt;
                Actions.progress({ progress: nowProgress });
            }, 10);
        }

        if (!isLoading && progress !== 0 && progress !== 100) {
            setImmediate(() => {
                Actions.progress({ progress: 100 });
                setTimeout(() => {
                    Actions.progress({ progress: 0 });
                }, 500);
            });
        }

        return (
            <div style={{
                width: "100%",
                position: "absolute",
                zIndex: 10000
            }}>
                <div style={{
                    width: `${progress}%`,
                    backgroundColor: color,
                    height: `${height}px`
                }}></div>
            </div>
        )
    }
}

export default Progress;