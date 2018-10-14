import {
    checkAuth,
    withError,
    api,
    token,
    redirect,
    I18n,
    __
} from "../utils/index.jsx"
import {
    Scroll,
    Fa,
    Pagination,
    Layout
} from "../components/index.jsx";
import _ from "lodash"
import React from "react";
import { Component } from "react"
import {
    Modal,
    ModalBody,
    ModalHeader,
    ModalFooter,
    FormGroup,
    Label,
    Form,
    Button,
    Input,
    Row,
    Col,
    Table
} from "reactstrap"

class EditUser extends Component {
    constructor (props) {
        super(props);
        this.state = {}
    }

    UNSAFE_componentWillReceiveProps (props) {
        if (!props.visible) return;
        let user = _.cloneDeep(props.user || {
            role: __.ROLES.USER
        });
        this.setState({
            visible: props.visible,
            projects: {},
            user
        });
    }

    saveUser () {
        return () => {
            withError(async () => {
                let { onSave, toggle } = this.props;
                let update = {
                    data: this.state.user
                }
                await api("users.editUser", token.get(), update);
                toggle();
                onSave();
            });
        }
    }

    change (field) {
        return (e) => {
            let state = _.cloneDeep(this.state);
            _.set(state, field, e.target.value);
            this.setState(state);
        }
    }

    render () {
        let { user } = this.state;
        let { visible, toggle, currentUser } = this.props;
        if (!visible) return <Modal isOpen={ false } />;

        let i18n = new I18n(currentUser);
        return (
            <Modal 
                isOpen={ visible }
                toggle={ toggle }
            >
                <ModalHeader>
                    { user._id ? i18n.t("Edit User") : i18n.t("Add User") }
                </ModalHeader>
                <ModalBody>
                    <Row>
                        <Col>
                            <FormGroup>
                                <Label>
                                    { i18n.t("Name") }
                                </Label>
                                <Input
                                    type="text"
                                    defaultValue={user.name}
                                    onChange={this.change("user.name")}
                                />
                            </FormGroup>
                        </Col>
                        <Col>
                            <FormGroup>
                                <Label>
                                    { i18n.t("Login") }
                                </Label>
                                <Input
                                    type="text"
                                    defaultValue={user.login}
                                    onChange={this.change("user.login")}
                                />
                            </FormGroup>
                        </Col>
                    </Row>

                    <Row>
                        <Col>
                            <FormGroup>
                                <Label>
                                    { i18n.t("E-mail") }
                                </Label>
                                <Input
                                    type="text"
                                    defaultValue={user.email}
                                    onChange={this.change("user.email")}
                                />
                            </FormGroup>
                        </Col>
                        <Col>
                            <FormGroup>
                                <Label>
                                    { i18n.t("Role") }
                                </Label>
                                <Input
                                    className="p-0"
                                    type="select"
                                    value={user.role}
                                    onChange={this.change("user.role")}
                                >
                                    {
                                        _.map(__.ROLES, (role, idx) => {
                                            if (
                                                currentUser.role !== __.ROLES.ROOT &&
                                                role === __.ROLES.ROOT
                                            ) return null;

                                            return (
                                                <option 
                                                    key={idx}
                                                    value={ role }>
                                                    { role }
                                                </option>
                                            )
                                        })
                                    }
                                </Input>
                            </FormGroup>
                        </Col>
                    </Row>

                    <FormGroup>
                        <Label>
                            { i18n.t("Language") }
                        </Label>
                        <Input
                            type="select"
                            value={ user.lang || "" }
                            onChange={this.change("user.lang")}
                        >
                           {
                               _.map(__.LANGS, lang => {
                                   return (
                                       <option key={ lang } value={ lang }>{ lang }</option>
                                   )
                               })
                           }
                        </Input>
                    </FormGroup>

                    <FormGroup>
                        <Label>
                            { i18n.t("Password") }
                        </Label>
                        <Input
                            type="password"
                            onChange={this.change("user.password")}
                        />
                    </FormGroup>
                </ModalBody>
                <ModalFooter>
                    <Button color="primary" onClick={ this.saveUser() }>
                        { i18n.t("Save") }
                    </Button>
                    <Button color="light" onClick={ toggle }>
                        { i18n.t("Cancel") }
                    </Button>
                </ModalFooter>
            </Modal>
        )
    }
}

EditUser.defaultProps = {
    onSave: function() {},
    toggle: function() {},
    visible: false
}

class Filter extends Component {
    constructor(props) {
        super(props)
        let { filter } = this.props;
        this.state = { filter }
    }

    filterSubmit () {
        return (e) => {
            e.preventDefault();
            redirect(null, "users", this.state.filter);
        }
    }

    change (field) {
        return (e) => {
            let state = _.cloneDeep(this.state);
            _.set(state, field, e.target.value);
            this.setState(state);
        }
    }

    pressEnter () {
        return (e) => {
            if (e.key !== "Enter") return
            this.filterSubmit()(e);
        }
    }

    toggle (name) {
        return () => {
            this.setState({
                [name]: !this.state[name]
            });
        }
    }

    render () {
        let { filter, currentUser } = this.props;
        let editUserState = "edit-user";
        let inlineFormStyle = "mb-2 mr-sm-2";
        let i18n = new I18n(currentUser);

        return (
            <Form inline className="w-100" onKeyDown={ this.pressEnter() }>
                <Input 
                    className={inlineFormStyle}
                    defaultValue={ filter.text } 
                    placeholder={ i18n.t("Simple Search") } 
                    onChange={ this.change("filter.text") }
                />

                <Button className={inlineFormStyle} onClick={ this.filterSubmit() }>
                    <Fa fa="search"></Fa> { i18n.t("Search") }
                </Button>
                
                {
                    currentUser.security[__.PERMISSION.USER.EDIT].global ?
                    [
                        <Button key={0} color="primary" className="ml-auto mb-2" onClick={this.toggle(editUserState)}>
                            <Fa fa="plus" /> { i18n.t("User") }
                        </Button>,
                        <EditUser
                            key={1}
                            currentUser={currentUser}
                            toggle={this.toggle(editUserState)}
                            visible={this.state[editUserState]}
                            onSave={() => global.router.reload()}
                        />
                    ] : null
                }
            </Form>
        )
    }
}

class Users extends Component {
    constructor (props) {
        super(props)
        this.state = {};
    }

    toggle (name) {
        return () => {
            this.setState({
                [ name ]: !this.state[ name ]
            });
        }
    }

    render () {
        let { users, filter, limit, user } = this.props;
        let currentUser = user;
        let i18n = new I18n(user);

        return (
            <Layout title={ i18n.t("Users") } page="users" user={user}>
                <Scroll>
                    <Filter filter={ filter } currentUser={currentUser} />
                    <Table responsive>
                        <thead>
                            <tr>
                                <th>{ i18n.t("Name") }</th>
                                <th>{ i18n.t("E-mail") }</th>
                                <th>{ i18n.t("Role") }</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {
                                _.map(users.list, (user, idx) => {
                                    let stateEdit = "edit-user-" + user._id;
                                    return (
                                        <tr key={ user._id }>
                                            <td>{ user.name }</td>
                                            <td>{ user.email }</td>
                                            <td>{ user.role }</td>
                                            <td>
                                                <Button outline color="success" size="sm" className="pull-right" onClick={this.toggle(stateEdit)} >
                                                    <Fa fa="info" />
                                                </Button>
                                                <EditUser 
                                                    toggle={this.toggle(stateEdit)}
                                                    visible={this.state[stateEdit]}
                                                    currentUser={ currentUser }
                                                    user={ user } 
                                                    onSave={() => global.router.reload()} 
                                                />
                                            </td>
                                        </tr>
                                    )
                                })
                            }
                        </tbody>
                    </Table>

                    <Pagination  
                        location="users"
                        filter={ filter }
                        count={ users.count }
                        limit={ limit }
                    />
                </Scroll>
            </Layout>
        )
    }
}

export default async (ctx) => {
    let { page = 0, text } = ctx.req.query
    let user = await checkAuth(ctx, __.PERMISSION.USER.VIEW, [ __.PERMISSION.USER.EDIT ]);
    let query = {};
    let fields = {
        password: 0,
        tokens: 0
    };
    let limit = 10;
    let skip = parseInt(page) * limit;

    if (user.role !== __.ROLES.ROOT) {
        let _idusers = await api("project.getProjectsDistinct", token.get(ctx), { 
            field: "users._iduser",
            query: {
                users: {
                    $elemMatch: {
                        role: __.PROJECT_USER_ROLES.ADMIN,
                        _iduser: user._id
                    }
                }
            } 
        });

        if (_idusers.length) {
            query.$and = query.$and || [];
            query.$and.push({
                $or: [
                    { _id: { $in: _idusers }},
                    { role: __.ROLES.ROADMAP }
                ]
            });
        } else {
            query._id = user._id;
        }
    }

    if (text) {
        query.$and = query.$and || [];
        query.$and.push({
            $or: [
                { login: { $regex: text, $options: "gmi" }},
                { name: { $regex: text, $options: "gmi" }},
                { email: { $regex: text, $options: "gmi" }},
                { role: { $regex: text, $options: "gmi" }}
            ]
        });
    }

    let users = await api("users.getUsers", token.get(ctx), { query, fields, limit, skip });
    return ctx.res._render(Users, {
        users,
        user,
        limit,
        filter: ctx.req.query
    });
}