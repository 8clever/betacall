import React from "react";
import { StickyContainer } from "react-sticky"
import PropTypes from "prop-types";

class Scroll extends React.Component {
    static get defaultProps () {
        return {
            className: "w-100"
        }
    }

    static get propTypes () {
        return {
            className: PropTypes.string
        }
    }

    render () {
        return (
            <StickyContainer {...this.props} className={`${this.props.className} scroll p-2`}>
                {this.props.children}
            </StickyContainer>
        )
    }
}

export default Scroll;