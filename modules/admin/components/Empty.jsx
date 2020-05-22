import React from "react";

class Empty extends React.Component {
    
    UNSAFE_componentWillReceiveProps (props) {
        if (props.title) {
            document.title = props.title;
        }
    }

    componentDidMount () {
        this.UNSAFE_componentWillReceiveProps(this.props);
    }

    render () {
        let { align = "align-items-center" } = this.props;
        return (
            <div className={ "d-flex " + align } style={{
                position: "absolute",
                padding: 0,
                width: "100%",
                height: "100vh",
                margin: 0
            }}>
                {this.props.children}
            </div>
        )
    }
}

export default Empty