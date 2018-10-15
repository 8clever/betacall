import React from "react";
import { Component } from "../utils/index.jsx";
import { InputGroup, InputGroupAddon, InputGroupText } from "reactstrap";
import Datetime from "react-datetime"
import PropTypes from "prop-types";
import InputMask from "react-input-mask";

class DatePicker extends Component {

    static get defaultProps () {
        return {
            format: "DD-MM-YYYY",
            mask: "99-99-9999"
        }
    }

    static get propTypes () {
        return {
            value: PropTypes.string,
            onChange: PropTypes.func.isRequired,
            format: PropTypes.string,
            mask: PropTypes.string
        }
    }

    render () {
        let { value, onChange, format, mask } = this.props;
        return (
            <Datetime
                dateFormat={format}
                timeFormat={false}
                defaultValue={value || ""}
                onChange={date => {
                    let value = date && date.toDate && date;
                    if (value) {
                        value = value.format(format)
                        onChange({ target: { value }});
                        return;
                    }

                    onChange({ target: { value: "" }});
                }}
                renderInput={props => {
                    return (
                        <InputGroup>
                            <InputMask
                                value={props.value}
                                onClick={props.onClick}
                                onChange={props.onChange}
                                className="form-control"
                                placeholder={format}
                                mask={mask}
                            />
                            <InputGroupAddon addonType="append">
                                <InputGroupText>
                                    <div className="fa fa-calendar" />
                                </InputGroupText>
                            </InputGroupAddon>
                        </InputGroup>
                    )
                }}
            />
        )
    }
}

export default DatePicker;