import React, { Component } from 'react';
import PropTypes from "prop-types";

export default class ReactPaint extends Component {
	static get propTypes() {
		return {
			className: PropTypes.string,
			style: PropTypes.object.isRequired,
			height: PropTypes.number,
			width: PropTypes.number,
			brushCol: PropTypes.string,
			lineWidth: PropTypes.oneOfType([
				PropTypes.string,
				PropTypes.number
			]),
			onDraw: PropTypes.func
		}
	}

	static get defaultProps () {
		return {
			className: 'react-paint',
			style: {},
			height: 500,
			width: 500,
			brushCol: '#ff6347',
			lineWidth: 10,
			onDraw: () => { }
		}
	}

	constructor(...props) {
		super(...props);

		this.state = {
			mouseDown: false,
			mouseLoc: [0, 0]
		};

		this.mouseDown = this.mouseDown.bind(this);
		this.mouseUp = this.mouseUp.bind(this);
		this.mouseMove = this.mouseMove.bind(this);

		this.canvasRef = React.createRef();
	}

	componentDidMount() {
		const { brushCol, lineWidth } = this.props;

		this.canvas = this.canvasRef.current.getContext('2d');
		this.canvas.lineWidth = lineWidth;
		this.canvas.strokeStyle = brushCol;
		this.canvas.lineJoin = this.canvas.lineCap = 'round';

		this.bb = this.canvasRef.current.getBoundingClientRect();
	}

	UNSAFE_componentWillUpdate(nextProps) {
		const { brushCol, lineWidth } = this.props;

		if (
			brushCol !== nextProps.brushCol ||
			lineWidth !== nextProps.lineWidth
		) {
			this.canvas.lineWidth = nextProps.lineWidth;
			this.canvas.strokeStyle = nextProps.brushCol;
		}
	}

	mouseDown (e) {
		if (!this.state.mouseDown) this.setState({ mouseDown: true });

		this.canvas.beginPath();

		this.setState({
			mouseLoc: [e.pageX || e.touches[0].pageX, e.pageY || e.touches[0].pageY]
		});

		this.canvas.moveTo(
			(e.pageX || e.touches[0].pageX) - this.bb.left,
			(e.pageY || e.touches[0].pageY) - this.bb.top
		);
	}

	mouseUp () {
		this.setState({ mouseDown: false })
	}

	mouseMove (e) {
		if (this.state.mouseDown) {
			// prevent IOS scroll when drawing
			if (e.touches) e.preventDefault();

			if (
				(e.pageX || e.touches[0].pageX) > 0 &&
				(e.pageY || e.touches[0].pageY) < this.props.height
			) {
				this.canvas.lineTo(
					((e.pageX || e.touches[0].pageX) - this.bb.left),
					((e.pageY || e.touches[0].pageY) - this.bb.top)
				);

				this.canvas.stroke();
			}
		}
	}

	render() {
		const {
			width,
			height,
			onDraw,
			style,
			className
		} = this.props;

		return (
			<div className={className}>
				<canvas
					ref={this.canvasRef}
					className={`${className}__canvas`}

					width={width}
					height={height}

					onClick={onDraw}

					style={
						Object.assign({}, style, {
							width: this.props.width,
							height: this.props.height
						})
					}

					onMouseDown={this.mouseDown}
					onTouchStart={this.mouseDown}

					onMouseUp={this.mouseUp}
					onTouchEnd={this.mouseUp}

					onMouseMove={this.mouseMove}
					onTouchMove={this.mouseMove}
				/>
			</div>
		);
	}
}


export { ReactPaint };
