const i18n = { t: txt => txt };

module.exports.PREFIX_ADMIN = "/admin";
module.exports.COMPANY_NAME = "call4all"

module.exports.ORDER_STATUS = {
    NEW: i18n.t("new"),
    IN_PROGRESS: i18n.t("in progress"),
    UNDER_CALL: i18n.t("under call"),
    DENY: i18n.t("deny"),
    DONE: i18n.t("done"),
    TRANSFER_DATE: i18n.t("transfer date")
}

module.exports.DELIVERY_TYPE = {
    PICKUP: "PICKUP",
    COURIER: "COURIER"
}

module.exports.LANGS = {
    PT: "pt",
    RU: "ru",
    EN: "en"
}

module.exports.LANG_DEF = module.exports.LANGS.EN;

module.exports.PERMISSION = {
    USER: {
        EDIT: "user.edit",
        VIEW: "user.view"
    },
    ORDER: {
        EDIT: "order.edit",
        VIEW: "order.view"
    }
}

module.exports.ROLES = {
    ADMIN: i18n.t("admin"),
    OPERATOR: i18n.t("operator")
}

module.exports.ERROR = {
    SUBJECT: {
        UNAUTHORIZED: "Unauthorized"
    }
}

module.exports.ESSENCE = {
    EMAIL: "emails",
    USERS: "users",
    LINKS: "links",
    ORDER: "orders"
};