import React, { useState } from "react";
import {
	Layout,
	Scroll,
	DatePicker,
	Panel,
	Pagination,
	Fa
} from "../components/index.jsx"
import {
	Socket,
	checkAuth,
	I18n,
	__,
	withError,
	api,
	token,
	Component,
	redirect
} from "../utils/index.jsx";
import {
	Alert,
	Card,
	CardBody,
	CardTitle,
	Label,
	FormGroup,
	Input,
	Table,
	Button,
	Modal,
	ModalBody,
	ModalHeader,
	ModalFooter,
	Row,
	Col
} from "reactstrap";
import _ from "lodash";
import moment from "moment";
import url from "url";
import { AddOrder } from "../components/AddOrder.jsx";

const AdminPage = props => {
	const { user, orders, limit } = props;
	const i18n = new I18n(user);
	const [stateFilter, setFilter] = useState(props.filter);
	let filter = Object.assign({}, stateFilter);

	React.useEffect(() => {
		setFilter(props.filter);
	}, [props.filter])

	React.useEffect(() => {
		let timeout = setTimeout(() => {
			global.router.reload();
		}, 30000);

		return () => clearTimeout(timeout);
	});

	const search = () => redirect(null, "index", filter);

	const downloadExcel = () => {
		window.location = url.format({
			pathname: "/excel/getCurrentCalls",
			query: stateFilter
		});
	}

	return (
		<Layout title={i18n.t("Home")} page="home" user={user}>
			<Scroll>

				<Card>
					<CardBody>
						<Row form>
							<Col md={2}>
								<Label>{i18n.t("Phone Number")}</Label>
								<Input
									value={filter.phone || ""}
									placeholder={i18n.t("Number...")}
									onChange={e => {
										filter.phone = e.target.value;
										setFilter(filter);
									}}
								/>
							</Col>
							<Col md={2}>
								<Label>{i18n.t("Order ID")}</Label>
								<Input
									value={filter.orderId || ""}
									placeholder={i18n.t("Number...")}
									onChange={e => {
										filter.orderId = e.target.value;
										setFilter(filter);
									}}
								/>
							</Col>
							<Col md={2}>
								<Label>{i18n.t("Delivery Type")}</Label>
								<Input
									type="select"
									onChange={e => {
										filter.deliveryType = e.target.value;
										setFilter(filter)
									}}
									value={filter.deliveryType || ""}>
									<option value={""}>
										{i18n.t("Not Selected")}
									</option>
									<option value={__.DELIVERY_TYPE.COURIER}>
										{i18n.t("Courier")}
									</option>
									<option value={__.DELIVERY_TYPE.PICKUP}>
										{i18n.t("Pickup")}
									</option>
								</Input>
							</Col>
							<Col md={6} className="text-right">
								<Label>&nbsp;</Label>
								<br />
								<Button
									onClick={search}
									color="primary">
									<Fa fa="refresh" /> {i18n.t("Search")}
								</Button>{" "}

								<Button
									color="light"
									onClick={downloadExcel}>
									<Fa fa="file-o" /> {"Excel"}
								</Button>
							</Col>
						</Row>
					</CardBody>
				</Card>

				<div className="mb-2"></div>

				<Card>
					<CardBody>
						<CardTitle>{i18n.t("Call Orders")}</CardTitle>

						{
							orders.list.length ?
								null :
								<Alert>
									<b>{i18n.t("Information")}</b>
									<p>{i18n.t("You not have active orders.")}</p>
								</Alert>
						}

						<Table responsive>
							<thead>
								<tr>
									<th>{i18n.t("Order ID")}</th>
									<th>{i18n.t("Phone")}</th>
									<th>{i18n.t("Client")}</th>
									<th>{i18n.t("Delivery Type")}</th>
									<th>{i18n.t("End of Storage Date")}</th>
									<th>{i18n.t("Market Name")}</th>
									<th>{i18n.t("Region")}</th>
									<th>{i18n.t("Full Price")}</th>
								</tr>
							</thead>
							<tbody>
								{
									_.map(orders.list, (order, key) => {
										let endOfStorageDate = _.get(order, "endOfStorageDate");
										if (endOfStorageDate) {
											endOfStorageDate = moment(endOfStorageDate).format("YYYY-MM-DD");
										}

										return (
											<tr key={key}>
												<td>{_.get(order, "orderIdentity.orderId")}</td>
												<td>{_.get(order, "clientInfo.phone")}</td>
												<td>{_.get(order, "clientInfo.fio")}</td>
												<td>{_.get(order, "deliveryType")}</td>
												<td>{endOfStorageDate}</td>
												<td>{_.get(order, "orderUrl")}</td>
												<td>{_.get(order, "deliveryAddress.region")}</td>
												<td>{_.get(order, "clientFullCost")} p.</td>
											</tr>
										)
									})
								}
							</tbody>
						</Table>
					</CardBody>
				</Card>

				<div className="mb-2"></div>

				<Pagination
					limit={limit}
					count={orders.count}
					filter={filter}
				/>
			</Scroll>
		</Layout>
	)
}

const colStyle = { minWidth: 135 };
class OperatorPage extends Component {
	constructor(props) {
		super(props);
		this.state = {
			order: props.order,
			holdTime: 0
		};

		this.warningMarkets = [
			"homshoppingrasha",
			"hsr24.ru"
		];
		this.canvasBodyRef = React.createRef();
	}

	componentDidMount() {
		let { user } = this.props;
		this.socket = Socket.connect();

		this.socket.on(user._id, (evt) => {
			withError(async () => {
				await api("order.addToMyOrders", token.get(), evt);
				global.router.reload();
			});
		});

		this.socket.on(user._id + "_holdTime", time => {
			this.setState({
				holdTime: time
			})
		});

		let setSize = () => {
			let $bodyCanvas = document.querySelector(".body-canvas");
			if (!$bodyCanvas) return;

			let { paint } = _.cloneDeep(this.state);
			let rect = $bodyCanvas.getBoundingClientRect();

			paint.width = rect.width;
			paint.height = rect.height;
			this.setState({ paint });
		}

		setSize();
		window.onresize = setSize;
	}

	componentWillUnmount() {
		this.socket.close();
		this.socket = null;
	}

	UNSAFE_componentWillReceiveProps(props) {
		this.setState({ order: props.order });
	}

	static get state() {
		return {
			replaceModal: "state-replace-modal",
			doneModal: "state-done-modal",
			denyModal: "state-deny-modal",
			undercallModal: "state-undercall-modal",
			skipModal: "state-skip-modal"
		}
	}

	replaceDate() {
		return () => {
			withError(async () => {
				let { order } = _.cloneDeep(this.state);
				await api("order.replaceCallDate", token.get(), {
					order: order.info,
					metadata: order.metadata,
					replaceDate: order.replaceDate
				});
				this.dropPhone()();
				global.router.reload();
				this.toggle(OperatorPage.state.replaceModal)();
			});
		}
	}

	setDone() {
		return () => {
			let { order, pickupId } = _.cloneDeep(this.state);
			withError(async () => {
				if (order.info.deliveryType === __.DELIVERY_TYPE.PICKUP) {
					await api("order.doneOrderPickup", token.get(), {
						order: order.info,
						metadata: order.metadata,
						pickupId
					});
				} else {
					await api("order.doneOrder", token.get(), {
						order: order.info,
						metadata: order.metadata
					});
				}
				this.dropPhone()();
				global.router.reload();
				this.toggle(OperatorPage.state.doneModal)();
			});
		}
	}

	setDeny() {
		return () => {
			let { order } = _.cloneDeep(this.state);
			withError(async () => {
				await api("order.denyOrder", token.get(), {
					order: order.info,
					metadata: order.metadata
				});
				this.dropPhone()();
				global.router.reload();
				this.toggle(OperatorPage.state.denyModal)();
			});
		}
	}

	dropPhone() {
		return () => {
			let { user } = this.props;
			let { order } = _.cloneDeep(this.state);
			let orderId = _.get(order, "info.orderIdentity.orderId");
			let idSocketDone = `${user._id}-${orderId}`;
			this.socket.emit("msg", {
				evtid: idSocketDone,
				done: 1
			});
		}
	}

	undercallOrder() {
		return () => {
			let { order } = _.cloneDeep(this.state);
			withError(async () => {
				await api("order.underCall", token.get(), {
					order: order.info,
					metadata: order.metadata
				});
				this.dropPhone()();
				global.router.reload();
				this.toggle(OperatorPage.state.undercallModal)();
			});
		}
	}

	skipOrder() {
		return () => {
			let { order } = _.cloneDeep(this.state);
			withError(async () => {
				await api("order.skipOrder", token.get(), {
					order: order.info,
					metadata: order.metadata
				});
				this.dropPhone()();
				global.router.reload();
				this.toggle(OperatorPage.state.skipModal)();
			});
		}
	}

	get(root, path, def) {
		return _.get(root, path) || def;
	}

	convertToYYYYMMDD(date, format) {
		return _.isDate(date) && moment(date).format(format) || "";
	}

	changeColor(path) {
		return ({ hex }) => {
			this.change(path)({ target: { value: hex } });
		}
	}

	render() {
		let { user, orders, filter, dateTimeIntervals, history } = this.props;
		let { order } = this.state;
		const i18n = new I18n(user);

		let desiredDate = this.get(order, "info.desiredDateDelivery.date", "");
		let storageDate = this.get(order, "info.endOfStorageDate", "");

		const dateTimeInteval = desiredDate && dateTimeIntervals.find(i => moment(i.date).format("YYYY-MM-DD") === desiredDate) || null;

		storageDate = this.convertToYYYYMMDD(storageDate, "YYYY-MM-DD");

		let timeStart = this.get(order, "info.desiredDateDelivery.timeInterval.bTime", "");
		let timeEnd = this.get(order, "info.desiredDateDelivery.timeInterval.eTime", "");

		const marketName = this.get(order, "info.orderUrl", "");

		if (!order) {
			return (
				<Layout title={i18n.t("Home")} page="home" user={user}>
					<Scroll>
						<Alert color="warning">
							<b>{i18n.t("Information")}</b>
							<p>
								{i18n.t("You not have available orders")}
							</p>
						</Alert>
						<Alert color="info">
							<b>{i18n.t("Helper")}</b>
							<p>
								{i18n.t("In this place you can reassign order by some cases")}
							</p>
							<AddOrder
								i18n={i18n}
							/>
						</Alert>
					</Scroll>
				</Layout>
			)
		}

		return (
			<Layout title={i18n.t("Home")} page="home" user={user}>
				{/** LEFT FORM */}
				<Scroll>
					<Card>
						<CardBody>
							<CardTitle>
								{i18n.t("Information about client")}
							</CardTitle>

							<FormGroup>
								<Label>{i18n.t("Name")}</Label>
								<Input
									value={this.get(order, "info.clientInfo.fio", "")}
									onChange={this.change("order.info.clientInfo.fio")}
								/>
							</FormGroup>

							<FormGroup>
								<Label>{i18n.t("Phone")}</Label>
								<Input
									value={this.get(order, "info.clientInfo.phone", "")}
									onChange={this.change("order.info.clientInfo.phone")}
								/>
							</FormGroup>

							<FormGroup>
								<Label>{i18n.t("E-mail")}</Label>
								<Input
									value={this.get(order, "info.clientInfo.email", "")}
									onChange={this.change("order.info.clientInfo.email")}
								/>
							</FormGroup>

							<FormGroup>
								<Label>{i18n.t("Comment")}</Label>
								<Input
									type="textarea"
									value={this.get(order, "info.clientInfo.comment", "")}
									onChange={this.change("order.info.clientInfo.comment")}
								/>
							</FormGroup>

						</CardBody>
					</Card>
					<div className="mb-2"></div>

					<Card>
						<CardBody>
							<CardTitle>
								{i18n.t("Information about delivery")}
							</CardTitle>

							<FormGroup>
								<Label>{i18n.t("Delivery Date")}</Label>
								<DatePicker
									isValidDate={current => {
										for (const i of dateTimeIntervals) {
											const isValid = current.isSame(i.date, "day") && i.quotas.available;
											if (isValid) return true;
										}
										return false;
									}}
									i18n={i18n}
									key={order.info.orderIdentity.orderId}
									value={desiredDate}
									onChange={this.change("order.info.desiredDateDelivery.date")}
									format="YYYY-MM-DD"
									mask={"9999-99-99"}
								/>
							</FormGroup>

							<FormGroup>
								<Label>{i18n.t("Time intervals")}</Label>
								<Input
									disabled={!desiredDate}
									type="select"
									onChange={e => {
										let { order } = _.cloneDeep(this.state);
										let [timeStart, timeEnd] = e.target.value.split("|");
										timeStart = timeStart || "";
										timeEnd = timeEnd || "";
										_.set(order, "info.desiredDateDelivery.timeInterval.bTime", timeStart);
										_.set(order, "info.desiredDateDelivery.timeInterval.eTime", timeEnd);
										this.setState({ order });
									}}
									value={timeStart && timeEnd && `${timeStart}|${timeEnd}` || ""}>
									<option value="">{i18n.t("Not Selected")}</option>
									{dateTimeInteval && dateTimeInteval.timeInterval.map((i, idx) => {
										return (
											<option
												key={idx}
												value={`${i.bTime}|${i.eTime}`}>
												{i.bTime} - {i.eTime}
											</option>
										)
									})}
								</Input>
							</FormGroup>

							<FormGroup>
								<Label>{i18n.t("Delivery Region")}</Label>
								<Input
									readOnly
									value={this.get(order, "info.deliveryAddress.region", "")}
									onChange={this.change("order.info.deliveryAddress.region")}
								/>
							</FormGroup>

							<FormGroup>
								<Label>{i18n.t("Delivery City")}</Label>
								<Input
									readOnly
									value={this.get(order, "info.deliveryAddress.city", "")}
									onChange={this.change("order.info.deliveryAddress.city")}
								/>
							</FormGroup>

							<FormGroup>
								<Label>{i18n.t("Zip Code")}</Label>
								<Input
									value={this.get(order, "info.deliveryAddress.inCityAddress.zipcode", "")}
									onChange={this.change("order.info.deliveryAddress.inCityAddress.zipcode")}
								/>
							</FormGroup>

							<FormGroup>
								<Label>{i18n.t("Delivery Address")}</Label>
								<Input
									value={this.get(order, "info.deliveryAddress.inCityAddress.address", "")}
									onChange={this.change("order.info.deliveryAddress.inCityAddress.address")}
								/>
							</FormGroup>

							<FormGroup check>
								<Label check>
									<Input
										type="radio"
										name="delivery-type"
										checked={this.get(order, "info.deliveryType") === __.DELIVERY_TYPE.COURIER}
										onChange={() => {
											this.change("order.info.deliveryType")({
												target: {
													value: __.DELIVERY_TYPE.COURIER
												}
											});
										}}
									/>
									{i18n.t("Courier")}
								</Label>
							</FormGroup>

							<FormGroup check>
								<Label check>
									<Input
										type="radio"
										name="delivery-type"
										checked={this.get(order, "info.deliveryType") === __.DELIVERY_TYPE.PICKUP}
										onChange={() => {
											this.change("order.info.deliveryType")({
												target: {
													value: __.DELIVERY_TYPE.PICKUP
												}
											});
										}}
									/>
									{i18n.t("Pickup")}
								</Label>
							</FormGroup>

							<div className="mb-2"></div>

							{
								this.get(order, "info.deliveryType") === __.DELIVERY_TYPE.PICKUP ?
									<FormGroup>
										<Label>{i18n.t("Pickup Point")}</Label>
										<Input
											type="select"
											value={this.get(this.state, "pickupId", "")}
											onChange={this.change("pickupId")}>
											<option value="">{i18n.t("Not Selected")}</option>
											{
												_.map(order.info.pickupPoints, (point, idx) => {
													return (
														<option key={idx} value={point.locationId}>
															{point.cityOfLocation} {point.addressOfLocation}
														</option>
													)
												})
											}
										</Input>
									</FormGroup> : null
							}

						</CardBody>
					</Card>
					<div className="mb-2"></div>
				</Scroll>

				{/** RIGHT FORM */}
				<Scroll>
					{
						order ?
							<div>
								<Card>
									<CardBody>
										<CardTitle>
											{i18n.t("Information about order")}
										</CardTitle>

										<Table bordered>
											<thead>
												<tr>
													<th>№ {i18n.t("Order")}</th>
													<th>{i18n.t("Bar Code")}</th>
													<th>№ {i18n.t("Order in market")}</th>
												</tr>
											</thead>
											<tbody>
												<tr>
													<td>{this.get(order, "info.orderIdentity.orderId", "")}</td>
													<td>{this.get(order, "info.orderIdentity.barcode", "")}</td>
													<td>{this.get(order, "info.orderIdentity.webshopNumber", "")}</td>
												</tr>
											</tbody>
										</Table>

										<FormGroup>
											<b>{i18n.t("status")}:</b> {this.get(order, "info.status.name", "")}
											<br />
											<b>{i18n.t("work status")}:</b> {this.get(order, "info.workStatus.name", "")}
											<br />
											<b>{i18n.t("market name")}:</b> {marketName}
											<br />

											{
												this.warningMarkets.includes(marketName) ?
													<Alert color="danger">
														<b>{i18n.t("Attention!")}</b>
														<p>
															{i18n.t("You should use other script for this market.")}
														</p>
													</Alert> : null
											}

											<b>{i18n.t("link")}:
                                            {" "}
												<a
													href={"https://is.topdelivery.ru/pages/order.php?id=" + this.get(order, "info.orderIdentity.orderId", "")}
													rel="noopener noreferrer"
													target="_blank">
													TopDelivery
                                            </a>
											</b>
										</FormGroup>

										<FormGroup>
											<Label>{i18n.t("End of storage date")}</Label>
											<DatePicker
												readOnly
												i18n={i18n}
												value={storageDate}
												onChange={e => {
													let date = e.target.value;
													if (date) {
														this.change("order.info.endOfStorageDate")({
															target: { value: moment(date, "YYYY-MM-DD").toDate() }
														});
													}
												}}
												format="YYYY-MM-DD"
												mask="9999-99-99"
											/>
										</FormGroup>

										<b>{i18n.t("Full order price")}:</b> {this.get(order, "info.clientFullCost", "")} p.
                                </CardBody>
								</Card>
								<div className="mb-2"></div>

								{/** ACTIONS */}
								<Card>
									<CardBody>
										<CardTitle>
											{i18n.t("Actions")}
										</CardTitle>

										<Button
											onClick={this.toggle(OperatorPage.state.doneModal)}
											color="success">
											{i18n.t("Done")}
										</Button>
										<Modal isOpen={!!this.state[OperatorPage.state.doneModal]}>
											<ModalHeader className="bg-warning">{i18n.t("Attention")}</ModalHeader>
											<ModalBody>{i18n.t("Are you set status to done, and go next?")}</ModalBody>
											<ModalFooter>
												<Button
													onClick={this.setDone()}
													color="warning">
													{i18n.t("Confirm")}
												</Button>
												<Button
													onClick={this.toggle(OperatorPage.state.doneModal)}
													color="light">
													{i18n.t("Cancel")}
												</Button>
											</ModalFooter>
										</Modal>

										{" "}
										<Button
											onClick={this.toggle(OperatorPage.state.denyModal)}
											color="danger">
											{i18n.t("Deny")}
										</Button>
										<Modal isOpen={!!this.state[OperatorPage.state.denyModal]}>
											<ModalHeader className="bg-danger text-white">{i18n.t("Are you sure deny order?")}</ModalHeader>
											<ModalBody>
												<FormGroup>
													<Label>{i18n.t("Deny Cause")}</Label>
													<Input
														onChange={this.change("order.info.denyParams.reason.id")}
														type="select">
														<option value="">{i18n.t("Not Selected")}</option>
														<option value={1}>{i18n.t("Delivery time violated")}</option>
														<option value={2}>{i18n.t("No money available")}</option>
														<option value={3}>{i18n.t("changed my mind to acquire")}</option>
														<option value={4}>{i18n.t("Purchased in another store")}</option>
														<option value={5}>{i18n.t("Did not order")}</option>
														<option value={6}>{i18n.t("Not phoned / expired")}</option>
														<option value={7}>{i18n.t("Other")}</option>
														<option value={8}>{i18n.t("Size does not match the stated")}</option>
														<option value={9}>{i18n.t("This product looks different than on the site.")}</option>
														<option value={10}>{i18n.t("Not satisfied with the quality")}</option>
														<option value={11}>{i18n.t("Another item deliverede")}</option>
													</Input>
												</FormGroup>
											</ModalBody>
											<ModalFooter>
												<Button
													onClick={this.setDeny()}
													color="danger">
													{i18n.t("Confirm")}
												</Button>
												<Button
													onClick={this.toggle(OperatorPage.state.denyModal)}
													color="light">
													{i18n.t("Cancel")}
												</Button>
											</ModalFooter>
										</Modal>
										{" "}

										<Button
											onClick={this.toggle(OperatorPage.state.undercallModal)}
											color="warning">
											{i18n.t("Under Call")}
										</Button>
										<Modal isOpen={!!this.state[OperatorPage.state.undercallModal]}>
											<ModalHeader className="bg-warning">{i18n.t("Attention!")}</ModalHeader>
											<ModalBody>{i18n.t("Are you sure set as undercall this order?")}</ModalBody>
											<ModalFooter>
												<Button color="warning" onClick={this.undercallOrder()}>
													{i18n.t("Confirm")}
												</Button>
												<Button color="light" onClick={this.toggle(OperatorPage.state.undercallModal)}>
													{i18n.t("Cancel")}
												</Button>
											</ModalFooter>
										</Modal>
										{" "}

									</CardBody>
								</Card>
								<div className="mb-2"></div>

								<Card>
									<CardBody>
										<CardTitle>
											{i18n.t("Replace call")}
										</CardTitle>
										<FormGroup>
											<Label>{i18n.t("Date Call")}</Label>
											<DatePicker
												isValidDate={current => {
													if (current.isBefore(new Date())) return false;
													return true
												}}
												i18n={i18n}
												value={""}
												format={"YYYY-MM-DD"}
												mask={"9999-99-99"}
												onChange={e => {
													let date = e.target.value;
													if (date) {
														this.change("order.replaceDate")({
															target: {
																value: moment(date, "YYYY-MM-DD").toDate()
															}
														});
													}
												}}
											/>
										</FormGroup>
										<Button
											onClick={this.toggle(OperatorPage.state.replaceModal)}
											color="warning">
											{i18n.t("Replace")}
										</Button>
										<Modal isOpen={!!this.state[OperatorPage.state.replaceModal]}>
											<ModalHeader className="bg-warning">{i18n.t("Attention")}</ModalHeader>
											<ModalBody>{i18n.t("Are you sure replace call and go next?")}</ModalBody>
											<ModalFooter>
												<Button
													onClick={this.replaceDate()}
													color="warning">
													{i18n.t("Confirm")}
												</Button>
												<Button
													onClick={this.toggle(OperatorPage.state.replaceModal)}
													color="light">
													{i18n.t("Cancel")}
												</Button>
											</ModalFooter>
										</Modal>
									</CardBody>
								</Card>
								<div className="mb-2"></div>
								<Card>
									<CardBody>
										<CardTitle>{i18n.t("History")}</CardTitle>
										<Table responsive borderless size="sm" striped hover>
											<thead>
												<tr>
													<th>{i18n.t("Date")}</th>
													<th>{i18n.t("Updated by")}</th>
													<th>{i18n.t("Title")}</th>
													<th>{i18n.t("New value")}</th>
													<th>{i18n.t("Previous value")}</th>
													<th>{i18n.t("Region")}</th>
													<th>{i18n.t("City")}</th>
													<th>{i18n.t("Comment")}</th>
												</tr>
											</thead>
											<tbody>
												{
													history[0] &&
													history[0].events.map(e => {

														return (
															<tr key={e.eventId}>
																<td style={colStyle}>{moment(e.date).format("DD.MM.YYYY HH:mm")}</td>
																<td style={colStyle}>{e.user}</td>
																<td style={colStyle}>{e.eventType.name}</td>
																<td style={colStyle}>{e.newValue}</td>
																<td style={colStyle}>{e.prevValue}</td>
																<td style={colStyle}>{e.region.name}</td>
																<td style={colStyle}>{e.city.name}</td>
																<td style={colStyle}>{e.comment}</td>
															</tr>
														)
												})}
											</tbody>
										</Table>
									</CardBody>
								</Card>
							</div>
							: null
					}
				</Scroll>
				<Scroll className="col-sm-2">
					{
						_.map(orders, (order, page) => {

							return (
								<Panel
									key={page}
									color={filter.page === page ? "primary" : "secondary"}
									onClick={() => {
										redirect(null, "index", { page })
									}}>
									{_.get(order, "info.clientInfo.phone")}

									<span className="text-muted">
										{" " + this.state.holdTime}
									</span>

									<br />
									<small className="text-muted">{_.get(order, "info.clientInfo.fio")}</small>
								</Panel>
							)
						})
					}
				</Scroll>
			</Layout>
		)
	}
}

export default async (ctx) => {
	let u = await checkAuth(ctx);
	let filter = _.cloneDeep(ctx.req.query);
	let limit = 20;
	filter.page = parseInt(ctx.req.query.page || 0);

	if (u.role === __.ROLES.ADMIN) {
		let query = {};

		if (filter.orderId) {
			query["orderIdentity.orderId"] = filter.orderId;
		}

		if (filter.phone) {
			query["clientInfo.phone"] = filter.phone;
		}

		if (filter.deliveryType) {
			query.deliveryType = filter.deliveryType;
		}

		let [orders] = await Promise.all([
			api("order.getOrders", token.get(ctx), {
				page: filter.page,
				query,
				limit
			})
		]);
		return ctx.res._render(AdminPage, {
			user: u,
			orders,
			filter,
			limit
		});
	}

	const orders = await api("order.getMyOrders", token.get(ctx), {});
	const order = orders[filter.page] || orders[0] || null;

	const dto = {
		user: u,
		orders,
		order,
		filter,
		dateTimeIntervals: []
	}

	if (order) {
		dto.history = await api("order.getHistoryByOrderId", token.get(ctx), order.info.orderIdentity)
		const intervals = await api("order.getNearDeliveryDatesIntervals", token.get(ctx), order.info.orderIdentity)
		dto.dateTimeIntervals.push(...intervals);
	}

	return ctx.res._render(OperatorPage, dto);
}