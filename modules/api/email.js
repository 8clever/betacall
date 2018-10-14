"use strict";

const _ = require('lodash');
const nodemailer = require('nodemailer');
const mandrill = require('mandrill-api/mandrill');
const CustomError = require('tinyback').CustomError;

var ctx, emailCfg, mandrillClient;

const __ = require("./__namespace");
const COLLECTION = __.ESSENCE;

let colls = {};
let api = {};
let transporter = null;
let qf = null;

module.exports.deps = ['scheduler', 'mongo'];
module.exports.init = async function(...args) {
	[ ctx ] = args;
	
	emailCfg = ctx.cfg.email;
	mandrillClient = new mandrill.Mandrill(emailCfg.apiKey);
	qf = ctx.api.prefixify.query;
	transporter = nodemailer.createTransport(emailCfg.smtp);

	ctx.api.validate.register("email", {
		$set: {
			properties: {
				_id: {
					type: "mongoId"
				},
				to: {
					type: "string",
					required: true
				},
				from: {
					type: "string",
					required: true
				},
				replyTo: {
					type: "string"
				},
				subject: {
					type: "string"
				},
				body: {
					type: "string",
					required: true
				},
				status: {
					type: "string",
					required: true
				},
				_dt:{
					type: "date",
					required: true
				},
				_dtchange:{
					type: "date"
				}
			}
		}
	});

	let db = await ctx.api.mongo.getDb({});
	colls[COLLECTION.EMAIL] = await db.collection(COLLECTION.EMAIL);
	await ctx.api.mongo.ensureIndex(colls[COLLECTION.EMAIL], { "to": 1 }, { unique: false });
	return { api };
};

api.getTemplate = async function(t, p){
	throw new Error("Invalid api function");
}


api.sendAllMessages = async function(t, p){
	if(!ctx.cfg.email.enable) return;
	let messages = await colls[COLLECTION.EMAIL].find({status: "new"}).toArray();
	if(!messages.length) return;

	var messageIds= _.map(messages, "_id");
	await colls[COLLECTION.EMAIL].update(
		{_id:{$in:messageIds}}, 
		{$set: {status: "processed"},$currentDate:{"_dtchange": true}}, 
		{ multi: true}
	);

	for (let mess of messages) {
		try {
			await ctx.api.email.sendMessage({}, { mess: mess });
			mess.status = "sended";
		} catch (err) {
			mess.status = "failed";
			mess.error = err.message;
								}
								delete mess._dtchange;
		await colls[COLLECTION.EMAIL].update(qf({ _id: mess._id }), { $set: mess, $currentDate: { "_dtchange": true } });
	}
}

/**
 * t
 * @param {Object} p.mess - message
 * @param p.mess.to
 * @param p.mess.subject
 * @param p.mess.body
 * @param [p.mess.replyTo]
 * @param [p.mess.attachments]
 */
api.sendMessage = async function(t, p){
	var mess = p.mess;
	var mailOptions =	{
		from: ctx.cfg.email.fromEmail,
		to: mess.to,
		subject: mess.subject,
		html: mess.body
	};

	if (mess.replyTo)
		mailOptions.replyTo = mess.replyTo;
	
	if(mess.attachment)
		mailOptions.attachments = [mess.attachment];
	
	if(mess.attachments)
		mailOptions.attachments = mess.attachments;
	
	await transporter.verify();
	await transporter.sendMail(mailOptions);
}

api.sendMessageTest = async function(t, p){
	var mess=p.mess;
	var _from = ctx.cfg.email.from;
	var mailOptions =	{
		from: mess.from || _from,
		to: ctx.cfg.email.to,
		subject: mess.subject,
		html: mess.html
	};
	if (mess.replyTo)
		mailOptions.replyTo = mess.replyTo;
	if(mess.attachment)
		mailOptions.attachments = [mess.attachment];
	if(mess.attachments)
		mailOptions.attachments = mess.attachments;
	await transporter.verify();
	await transporter.sendMail(mailOptions);
}

api.sendEmail = async function(t, p) {
	if(!emailCfg.enable) return;
	let merge_vars = [], message = {
		from_email: emailCfg.fromEmail,
		from_name: emailCfg.fromName,
		to: [{email: p.to}],
		important: false,
		track_opens: true,
		track_clicks: true,
		auto_text: !p.html,
		auto_html: !!p.html,
		global_merge_vars: merge_vars,
		merge_language: "handlebars"
	};

	if (emailCfg.sandbox) {
		message.to = emailCfg.toEmails;
	}

	if (!p.html){
		p.templateData.recepient = p.recepient;
		_.each(p.templateData, function(v, k) {
			merge_vars.push({
				name: k,
				content: v
			});
		});

		return new Promise((resolve, reject) => {
			mandrillClient.messages.sendTemplate({
				template_name: p.templateName || emailCfg.templates.newDelivery.slug,
				template_content: [],
				message: message,
				async: true
			}, resolve, err => {
				reject(new CustomError(err.message, err.name));
			});
		});
	}
	message.subject = p.subject || "Garner";
	message.html = p.html;
	if (ctx.cfg.automated) {
		ctx.api.email.sendMessageTest({}, {mess: message});
	} else {
		return new Promise((resolve, reject) => {
			mandrillClient.messages.send({ "message": message, "async": true }, resolve, err => {
				reject(new CustomError(err.message, err.name));
			});
		})
	}
}
