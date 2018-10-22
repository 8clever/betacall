const i18n = { t: txt => txt };

module.exports.PREFIX_ADMIN = "/admin";
module.exports.COMPANY_NAME = "call4all"

module.exports.DELIVERY_TYPE = {
    PICKUP: "PICKUP",
    COURIER: "COURIER"
}

module.exports.LANGS = {
    PT: "pt",
    RU: "ru",
    EN: "en"
}

module.exports.CALL_STATUS = {
    DONE: "done",
    UNNAVAILABLE: "unnavailable"
}

module.exports.ORDER_STATUS = {
    DONE: "done",
    DENY: "deny",
    UNDER_CALL: "under_call",
    REPLACE_DATE: "replace_date",
    SKIP: "skip",
    PICKUP: "pickup"
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
    },
    STATS: {
        VIEW: "stats.view"
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
    STATS: "stats"
};