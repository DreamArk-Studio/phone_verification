ll.registerPlugin(
    /* name */
    "phone_verification",
    /* introduction */
    "手机号验证",
    /* version */
    [1, 1, 0],
    /* otherInformation */
    {
        "author": "星雲Nebulae"
    }
);

const dataFile = './plugins/phone_verification/player_data.json';
const configFile = './plugins/phone_verification/config.json';
const phoneCodeMap = new Map(); // 临时缓存验证码

function initStorage() {
    if (!File.exists(dataFile)) {
        File.writeTo(dataFile, '{}');
    }
    
    // 初始化配置文件
    if (!File.exists(configFile)) {
        const defaultConfig = {
            "sms": {
                // 阿里云短信服务API
                "apiUrl": "https://dfsns.market.alicloudapi.com/data/send_sms",
                /* 阿里云短信服务AppCode */
                "appCode": "your_app_code",
                /* 短信模板ID */
                "templateId": "CST_ptdie100",
                "Warning!!!":"因为每一家的sms接口参数可能存在差异，并不保证所有的sms都可以在本插件使用。本插件按照北京深智恒际科技有限公司的接口参数进行编写。链接：https://market.aliyun.com/apimarket/detail/cmapi00037170#sku=yuncode31170000018 （并非广告）"
            }
        };
        File.writeTo(configFile, JSON.stringify(defaultConfig, null, 2));
    }
}

function loadData() {
    const content = File.readFrom(dataFile);
    return content ? JSON.parse(content) : {};
}

function saveData(data) {
    File.writeTo(dataFile, JSON.stringify(data, null, 2));
}

function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function sendSMS(phone, code) {
    // 从配置文件读取API信息
    const configContent = File.readFrom(configFile);
    const config = configContent ? JSON.parse(configContent) : {};
    const smsConfig = config.sms || {};
    
    const body = `phone_number=${phone}&template_id=${smsConfig.templateId || "CST_ptdie100"}&content=code:${code}`;
    const headers = {
        "Authorization": `APPCODE ${smsConfig.appCode}`,
        "Content-Type": "application/x-www-form-urlencoded"
    };
    const type = "application/x-www-form-urlencoded";

    network.httpPost(
        smsConfig.apiUrl,
        headers,
        body,
        type,
        (status, res) => {
            if (status === 200) {
                logger.info(`[SMS] 已发送验证码到 ${phone}`);
            } else {
                logger.error(`[SMS] 发送失败：状态码 ${status}`);
                logger.debug(res);
            }
        }
    );
}

mc.listen("onJoin", (pl) => {
    const name = pl.realName;
    const db = loadData();

    if (!db[name]) {
        setTimeout(() => showPhoneForm(pl), 100); // 防止刚进服时UI未初始化
    }
});

function showPhoneForm(pl) {
    const fm = mc.newCustomForm();
    fm.setTitle("手机号验证");
    fm.addInput("请输入手机号（每个号码最多绑定1个账号）", "例：13812345678");

    pl.sendForm(fm, (pl, data, reason) => {
        if (data === null || data === undefined) {
            pl.kick("§c你必须完成手机号验证才能进入服务器！");
            return;
        }

        const phone = data[0].trim();
        if (!/^1[3-9]\d{9}$/.test(phone)) {
            pl.tell("§c手机号格式错误，请重新输入！");
            return showPhoneForm(pl);
        }

        const db = loadData();
        const bindCount = Object.values(db).filter(info => info.phone === phone).length;
        if (bindCount >= 1) {
            pl.tell("§c该手机号已绑定一个账号！");
            return showPhoneForm(pl);
        }

        const code = generateCode();
        phoneCodeMap.set(phone, code);
        sendSMS(phone, code);
        pl.tell(`§a验证码已发送到 ${phone}，请查收`);
        showCodeForm(pl, phone);
    });
}

function showCodeForm(pl, phone) {
    const fm = mc.newCustomForm();
    fm.setTitle("验证码验证");
    fm.addInput("请输入短信验证码（6位）", "例：123456");

    pl.sendForm(fm, (pl, data, reason) => {
        if (data === null || data === undefined) {
            pl.kick("§l 你必须完成验证码验证才能进入服务器！");
            return;
        }

        const input = data[0].trim();
        const real = phoneCodeMap.get(phone);

        if (input === real) {
            const db = loadData();
            db[pl.realName] = {
                phone: phone,
                time: new Date().toISOString()
            };
            saveData(db);
            phoneCodeMap.delete(phone);
            pl.tell("§l验证成功，欢迎进入服务器！");
        } else {
            pl.tell("§c验证码错误，请重新输入！");
            showCodeForm(pl, phone);
        }
    });
}

mc.listen("onServerStarted", () => {
    initStorage();
    logger.info("✅ [phone_verification] 插件已启动");
    logger.info("🏢 DreamArk Studio");
    logger.info("🤵 作者：@Nebulae");
});
