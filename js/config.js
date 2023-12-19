// config.js
export const DID_API = {
    url: 'https://api.d-id.com', // 这里替换成实际的API URL
    key: 'OTk0ODEwNTUyQHFxLmNvbQ:MOHqIx7d1VAjnBlAhIppL', // 将YOUR_API_KEY_HERE替换成您的API密钥
};

export const openAIConfig = {
    apiKey: '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', // 将YOUR_OPENAI_API_KEY_HERE替换成您的OpenAI API密钥
    models: {
        turbo: 'gpt-3.5-turbo',
        davinci: 'text-davinci-003'
    },
    getChatEndpoint: function(model) {
        return model === this.models.turbo ?
            'https://api.openai.com/v1/chat/completions' :
            `https://api.openai.com/v1/engines/${model}/completions`;
    }
};

// 情绪设置
export const emotionsWithIntensity = {
    'neutral': { label: '中性', intensity: 0.5 },
    'happy': { label: '开心', intensity: 1.0 },
    'surprise': { label: '惊喜', intensity: 1.0 },
    'serious': { label: '严肃', intensity: 0.5 }
    // 根据需要添加更多情绪
};


// 风格设置
export const stylesTranslations = {
    'assistant': '助手',
    'chat': '聊天',
    'customerservice': '客服',
    'newscast': '新闻播报',
    'affectionate': '亲密',
    'angry': '愤怒',
    'calm': '平静',
    'cheerful': '愉快',
    'disgruntled': '不满',
    'fearful': '恐惧',
    'gentle': '温柔',
    'lyrical': '抒情',
    'sad': '悲伤',
    'serious': '严肃',
    'poetry-reading': '朗读诗歌',
    'friendly': '友好',
    'chat-casual': '随便聊',
    'whisper': '耳语',
    'sorry': '抱歉',
    'narration-relaxed': '松弛',
    'embarrassed':'尴尬',
    'depressed':'沮丧',
    'sports-commentary':'体育评论',
    'sports-commentary-excited':'体育解说兴奋',
    'documentary-narration':'纪实叙事',
    'narration-professional':'叙事专业',
    'newscast-casual':'新闻广播-休闲',
    'livecommercial':'商业生活',
    'advertisement-upbeat':'广告-乐观',
    'envious':'羡慕'
};
