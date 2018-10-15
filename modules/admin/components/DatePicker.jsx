import React from "react";
import { Component } from "../utils/index.jsx";
import { InputGroup, InputGroupAddon, InputGroupText } from "reactstrap";
import Datetime from "react-datetime"
import PropTypes from "prop-types";
import InputMask from "react-input-mask";

class DatePicker extends Component {

    static get propTypes () {
        return {
            value: PropTypes.string,
            onChange: PropTypes.func.isRequired
        }
    }

    render () {
        let { value, onChange } = this.props;
        return (
            <Datetime
                dateFormat="DD-MM-YYYY"
                timeFormat={false}
                defaultValue={value || ""}
                onChange={date => {
                    let value = date && date.toDate && date;
                    if (value) {
                        value = value.format("DD-MM-YYYY")
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
                                placeholder="DD-MM-YYYY"
                                mask="99-99-9999"
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