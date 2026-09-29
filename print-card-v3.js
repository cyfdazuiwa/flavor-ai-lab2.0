// 打印卡片功能 - 14cm x 10cm 竖版小卡片
// 风格：参考用户提供的排版设计
(function() {
    'use strict';
    
    console.log('Print card script loading...');
    
    // 创建打印按钮
    function createPrintButton() {
        const btn = document.createElement('button');
        btn.id = 'print-card-btn';
        btn.innerHTML = '🖨️ 打印结果卡片';
        btn.style.cssText = `
            display: none;
            width: 100%;
            padding: 16px;
            background: #333;
            color: #fff;
            border: none;
            font-size: 16px;
            cursor: pointer;
            margin-top: 20px;
        `;
        btn.onclick = printCard;
        
        const root = document.getElementById('root');
        if (root) {
            root.appendChild(btn);
        } else {
            document.body.appendChild(btn);
        }
        return btn;
    }
    
    // 创建打印容器
    function createPrintContainer() {
        const container = document.createElement('div');
        container.id = 'print-card-container';
        container.className = 'print-only';
        document.body.appendChild(container);
        return container;
    }
    
    // 添加打印样式
    function addPrintStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .print-only { display: none !important; }
            
            @media print {
                @page {
                    size: 10cm 14cm;
                    margin: 0;
                }
                
                body > *:not(.print-only) { display: none !important; }
                
                .print-only {
                    display: block !important;
                    position: fixed;
                    top: 0; left: 0;
                    width: 100vw; height: 100vh;
                    background: #F5F5F0;
                    margin: 0; padding: 0;
                    overflow: hidden;
                }
                
                .print-card-content {
                    width: 10cm;
                    height: 14cm;
                    margin: 0 auto;
                    background: #F5F5F0;
                    padding: 0.4cm;
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    font-family: "Helvetica Neue", Arial, sans-serif;
                }
                
                /* 木 - 绿色 */
                .print-card-content[data-wuxing="木"] {
                    background: #E8F5E9;
                }
                
                /* 火 - 红色 */
                .print-card-content[data-wuxing="火"] {
                    background: #FFEBEE;
                }
                
                /* 土 - 黄色 */
                .print-card-content[data-wuxing="土"] {
                    background: #FFF8E1;
                }
                
                /* 金 - 金色 */
                .print-card-content[data-wuxing="金"] {
                    background: #FFFDE7;
                }
                
                /* 水 - 蓝色 */
                .print-card-content[data-wuxing="水"] {
                    background: #E3F2FD;
                }
                
                /* 顶部区域 */
                .print-header {
                    text-align: center;
                    margin-bottom: 0.3cm;
                }
                
                .print-header .drink-img {
                    width: 2.5cm;
                    height: auto;
                    margin-bottom: 0.2cm;
                }
                
                .print-header h1 {
                    font-size: 22pt !important;
                    margin: 0 0 0.1cm 0 !important;
                    font-weight: 500;
                    color: #000;
                    letter-spacing: 0.05em;
                }
                
                .print-header .nayin {
                    font-size: 10pt;
                    color: #666;
                    margin: 0.05cm 0;
                }
                
                .print-header .wuxing {
                    font-size: 10pt;
                    color: #4a7c59;
                    margin: 0;
                    letter-spacing: 0.1em;
                }
                
                /* 中间两栏区域 */
                .print-body {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 0.3cm;
                    width: 100%;
                    flex: 1;
                }
                
                .print-body .left-col,
                .print-body .right-col {
                    border: 1px solid #333;
                    padding: 0.2cm;
                    display: flex;
                    flex-direction: column;
                }
                
                .col-title {
                    font-size: 8pt;
                    font-weight: 600;
                    text-align: center;
                    margin-bottom: 0.1cm;
                    color: #000;
                }
                
                /* 雷达图 */
                .radar-container {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .radar-container svg,
                .radar-container canvas {
                    max-width: 3cm !important;
                    max-height: 3cm !important;
                }
                
                /* 五行图例 */
                .wuxing-legend {
                    display: flex;
                    justify-content: center;
                    gap: 0.2cm;
                    font-size: 7pt;
                    margin: 0.1cm 0;
                }
                
                .wuxing-legend span {
                    display: flex;
                    align-items: center;
                    gap: 0.05cm;
                }
                
                .wuxing-legend .dot {
                    width: 0.15cm;
                    height: 0.15cm;
                    border-radius: 50%;
                    display: inline-block;
                }
                
                /* 气泡温度 */
                .properties {
                    display: flex;
                    justify-content: center;
                    gap: 0.5cm;
                    border-top: 1px solid #ddd;
                    padding-top: 0.1cm;
                    margin-top: 0.1cm;
                }
                
                .property-item {
                    text-align: center;
                }
                
                .property-label {
                    font-size: 6pt;
                    color: #999;
                }
                
                .property-value {
                    font-size: 8pt;
                    color: #000;
                    font-weight: 500;
                }
                
                /* 右栏内容 */
                .desc-box {
                    border-bottom: 1px solid #ddd;
                    padding-bottom: 0.15cm;
                    margin-bottom: 0.15cm;
                }
                
                .desc-box p {
                    font-size: 8pt;
                    line-height: 1.4;
                    color: #333;
                    margin: 0;
                }
                
                .insight-box {
                    border-bottom: 1px solid #ddd;
                    padding-bottom: 0.15cm;
                    margin-bottom: 0.15cm;
                }
                
                .insight-box p {
                    font-size: 7pt;
                    line-height: 1.3;
                    color: #666;
                    margin: 0;
                }
                
                .insight-box .bulb {
                    color: #f0c040;
                }
                
                /* 最佳伴侣 */
                .partner-title {
                    font-size: 8pt;
                    color: #e07070;
                    margin-bottom: 0.1cm;
                }
                
                .partner-title .heart {
                    color: #e07070;
                }
                
                .partner-content {
                    display: flex;
                    align-items: center;
                    gap: 0.2cm;
                    border: 1px solid #333;
                    padding: 0.1cm;
                }
                
                .partner-content img {
                    width: 0.8cm;
                    height: auto;
                }
                
                .partner-info {
                    flex: 1;
                }
                
                .partner-name {
                    font-size: 9pt;
                    color: #000;
                    font-weight: 500;
                }
                
                .partner-nayin {
                    font-size: 7pt;
                    color: #999;
                }
                
                .match-btn {
                    border: 1px solid #333;
                    padding: 0.05cm 0.15cm;
                    font-size: 7pt;
                    background: #fff;
                }
                
                /* 底部 */
                .print-footer {
                    font-size: 6pt;
                    color: #bbb;
                    margin-top: 0.2cm;
                    text-align: center;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // 检查是否在结果页
    function isResultPage() {
        const bodyText = document.body.innerText;
        const drinks = ['青柚乌龙', '松针青梅', '赤霞血橙', '暖姜红茶', '海盐白桃', '椰青荔枝', '玄米柠檬', '燕麦可可', '茉莉汤力', '轻咖汤力', '青桔乳酸', '紫苏话梅'];
        return drinks.some(d => bodyText.includes(d)) && bodyText.includes('纳音');
    }
    
    // 过滤无效文本
    function isValidText(text) {
        if (!text || text.trim().length === 0) return false;
        const invalidPatterns = ['测试', 'RESULT', 'Question', 'Result', '的'];
        return !invalidPatterns.some(p => text.includes(p));
    }
    
    // 克隆结果页内容并重新排版
    function cloneAndReformat() {
        console.log('Cloning and reformatting...');
        const container = document.getElementById('print-card-container');
        container.innerHTML = '';
        
        const cardContent = document.createElement('div');
        cardContent.className = 'print-card-content';
        
        const root = document.getElementById('root');
        if (!root) {
            console.error('Root not found');
            return;
        }
        
        const allP = Array.from(root.querySelectorAll('p'));
        const h3s = Array.from(root.querySelectorAll('h3'));
        
        // ===== 顶部区域 =====
        const header = document.createElement('div');
        header.className = 'print-header';
        
        // 饮品图片
        const allImgs = Array.from(root.querySelectorAll('img'));
        const drinkImg = allImgs.find(img => {
            const rect = img.getBoundingClientRect();
            return rect.width > 50 || img.naturalWidth > 50;
        });
        if (drinkImg) {
            const img = document.createElement('img');
            img.src = drinkImg.src;
            img.alt = drinkImg.alt || '';
            img.className = 'drink-img';
            header.appendChild(img);
        }
        
        // 饮品名称
        const h1 = root.querySelector('h1');
        if (h1 && isValidText(h1.textContent)) {
            const name = document.createElement('h1');
            name.textContent = h1.textContent;
            header.appendChild(name);
        }
        
        // 纳音
        const nayinP = allP.find(p => p.textContent.includes('纳音'));
        if (nayinP && isValidText(nayinP.textContent)) {
            const nayin = document.createElement('p');
            nayin.className = 'nayin';
            nayin.textContent = nayinP.textContent;
            header.appendChild(nayin);
        }
        
        // 五行分布
        const wuxingP = allP.find(p => /[木火土金水]\d/.test(p.textContent));
        if (wuxingP && isValidText(wuxingP.textContent)) {
            const wuxing = document.createElement('p');
            wuxing.className = 'wuxing';
            wuxing.textContent = wuxingP.textContent;
            header.appendChild(wuxing);
        }
        
        // 判断主五行属性
        let mainWuxing = '';
        const wuxingMatch = root.innerText.match(/([木火土金水])\d/);
        if (wuxingMatch) {
            mainWuxing = wuxingMatch[1];
            console.log('Main wuxing:', mainWuxing);
        }
        
        // 设置五行属性
        if (mainWuxing) {
            cardContent.setAttribute('data-wuxing', mainWuxing);
        }
        
        // ===== 中间两栏区域 =====
        const body = document.createElement('div');
        body.className = 'print-body';
        
        // 左栏
        const leftCol = document.createElement('div');
        leftCol.className = 'left-col';
        
        // 五行属性分布标题
        const wuxingH3 = h3s.find(h => h.textContent.includes('五行'));
        if (wuxingH3) {
            const title = document.createElement('div');
            title.className = 'col-title';
            title.textContent = wuxingH3.textContent;
            leftCol.appendChild(title);
        }
        
        // 雷达图
        const radar = root.querySelector('svg, canvas');
        if (radar) {
            const radarContainer = document.createElement('div');
            radarContainer.className = 'radar-container';
            const radarClone = radar.cloneNode(true);
            if (radarClone.tagName === 'svg' || radarClone.tagName === 'SVG') {
                radarClone.setAttribute('class', '');
            }
            radarClone.style.maxWidth = '3cm';
            radarClone.style.maxHeight = '3cm';
            radarContainer.appendChild(radarClone);
            leftCol.appendChild(radarContainer);
        }
        
        // 五行图例
        const legendContainer = document.createElement('div');
        legendContainer.className = 'wuxing-legend';
        const wuxingMatch = root.innerText.match(/([木火土金水]\d)/g);
        if (wuxingMatch) {
            const colors = {
                '木': '#4a7c59',
                '火': '#c45533',
                '土': '#b8956a',
                '金': '#8a8a8a',
                '水': '#4a6fa5'
            };
            wuxingMatch.forEach(item => {
                const element = item[0];
                const num = item[1];
                const span = document.createElement('span');
                span.innerHTML = `<span class="dot" style="background:${colors[element] || '#333'}"></span> ${element} ${num}`;
                legendContainer.appendChild(span);
            });
        }
        leftCol.appendChild(legendContainer);
        
        // 气泡温度
        const allText = root.innerText;
        const bubbleMatch = allText.match(/气泡[\s\n]*([^\n]+)/);
        const tempMatch = allText.match(/温度[\s\n]*([^\n]+)/);
        
        if (bubbleMatch || tempMatch) {
            const props = document.createElement('div');
            props.className = 'properties';
            
            if (bubbleMatch && isValidText(bubbleMatch[1])) {
                const item = document.createElement('div');
                item.className = 'property-item';
                item.innerHTML = `
                    <div class="property-label">气泡</div>
                    <div class="property-value">${bubbleMatch[1].trim()}</div>
                `;
                props.appendChild(item);
            }
            
            if (tempMatch && isValidText(tempMatch[1])) {
                const item = document.createElement('div');
                item.className = 'property-item';
                item.innerHTML = `
                    <div class="property-label">温度</div>
                    <div class="property-value">${tempMatch[1].trim()}</div>
                `;
                props.appendChild(item);
            }
            
            leftCol.appendChild(props);
        }
        
        body.appendChild(leftCol);
        
        // 右栏
        const rightCol = document.createElement('div');
        rightCol.className = 'right-col';
        
        // 描述文案
        const descP = allP.find(p => {
            const text = p.textContent.trim();
            return text.length > 20 
                && text.length < 100
                && !text.includes('纳音')
                && !text.includes('五行')
                && !text.includes('气泡')
                && !text.includes('温度')
                && !text.includes('伴侣')
                && !text.includes('音乐')
                && !text.includes('💡')
                && !text.includes('测试')
                && !text.includes('RESULT');
        });
        if (descP && isValidText(descP.textContent)) {
            const descBox = document.createElement('div');
            descBox.className = 'desc-box';
            const p = document.createElement('p');
            p.textContent = descP.textContent;
            descBox.appendChild(p);
            rightCol.appendChild(descBox);
        }
        
        // 洞察
        const insightP = allP.find(p => p.textContent.includes('建议') || p.textContent.includes('优势') || p.textContent.includes('能力'));
        if (insightP && isValidText(insightP.textContent)) {
            const insightBox = document.createElement('div');
            insightBox.className = 'insight-box';
            const p = document.createElement('p');
            p.innerHTML = '<span class="bulb">💡</span> ' + insightP.textContent.replace('💡', '').trim();
            insightBox.appendChild(p);
            rightCol.appendChild(insightBox);
        }
        
        // 最佳伴侣
        const partnerH3 = h3s.find(h => h.textContent.includes('伴侣'));
        console.log('Partner H3 found:', partnerH3 ? partnerH3.textContent : 'not found');
        if (partnerH3) {
            const partnerTitle = document.createElement('div');
            partnerTitle.className = 'partner-title';
            partnerTitle.innerHTML = '<span class="heart">💕</span> 最佳伴侣';
            rightCol.appendChild(partnerTitle);
            
            const partnerContent = document.createElement('div');
            partnerContent.className = 'partner-content';
            
            // 找伴侣图片 - 遍历后面的元素
            let imgFound = false;
            let nextEl = partnerH3.nextElementSibling;
            while (nextEl) {
                console.log('Checking element:', nextEl.tagName, nextEl.className);
                if (nextEl.tagName === 'IMG') {
                    console.log('Found partner img:', nextEl.src);
                    const partnerImg = document.createElement('img');
                    partnerImg.src = nextEl.src;
                    partnerImg.alt = nextEl.alt || '';
                    partnerContent.appendChild(partnerImg);
                    imgFound = true;
                    break;
                }
                // 如果下一个元素是容器，在里面找图片
                if (nextEl.querySelector) {
                    const innerImg = nextEl.querySelector('img');
                    if (innerImg) {
                        console.log('Found inner partner img:', innerImg.src);
                        const partnerImg = document.createElement('img');
                        partnerImg.src = innerImg.src;
                        partnerImg.alt = innerImg.alt || '';
                        partnerContent.appendChild(partnerImg);
                        imgFound = true;
                        break;
                    }
                }
                nextEl = nextEl.nextElementSibling;
            }
            console.log('Image found:', imgFound);
            
            // 伴侣信息
            const partnerInfo = document.createElement('div');
            partnerInfo.className = 'partner-info';
            
            // 找伴侣名称 - 遍历后面的元素找文本
            let nameFound = false;
            let nameEl = partnerH3.nextElementSibling;
            while (nameEl) {
                if (nameEl.textContent && nameEl.textContent.trim().length > 0) {
                    const text = nameEl.textContent.trim();
                    if (text !== '' && !text.includes('💕') && !text.includes('伴侣') && nameEl.tagName !== 'IMG') {
                        console.log('Found partner name:', text);
                        const partnerName = document.createElement('div');
                        partnerName.className = 'partner-name';
                        partnerName.textContent = text;
                        partnerInfo.appendChild(partnerName);
                        nameFound = true;
                        
                        // 找伴侣纳音
                        let nayinEl = nameEl.nextElementSibling;
                        if (nayinEl && nayinEl.textContent && nayinEl.textContent.includes('纳音')) {
                            const partnerNayin = document.createElement('div');
                            partnerNayin.className = 'partner-nayin';
                            partnerNayin.textContent = nayinEl.textContent;
                            partnerInfo.appendChild(partnerNayin);
                        }
                        break;
                    }
                }
                nameEl = nameEl.nextElementSibling;
            }
            console.log('Name found:', nameFound);
            
            if (!nameFound) {
                // 备用方案
                const partnerNameP = allP.find(p => {
                    const text = p.textContent.trim();
                    return text.length > 0 && text.length < 20 && !text.includes('纳音') && !text.includes('测试');
                });
                if (partnerNameP) {
                    const partnerName = document.createElement('div');
                    partnerName.className = 'partner-name';
                    partnerName.textContent = partnerNameP.textContent;
                    partnerInfo.appendChild(partnerName);
                }
            }
            
            partnerContent.appendChild(partnerInfo);
            
            // 合拍按钮
            const matchBtn = document.createElement('span');
            matchBtn.className = 'match-btn';
            matchBtn.textContent = '合拍';
            partnerContent.appendChild(matchBtn);
            
            rightCol.appendChild(partnerContent);
        }
        
        body.appendChild(rightCol);
        cardContent.appendChild(body);
        
        // 底部
        const footer = document.createElement('div');
        footer.className = 'print-footer';
        footer.textContent = '五行纳音 · 本命饮品';
        cardContent.appendChild(footer);
        
        container.appendChild(cardContent);
        console.log('Card content created');
    }
    
    // 打印卡片
    function printCard() {
        console.log('Print button clicked');
        if (!isResultPage()) {
            alert('未检测到结果内容，请确保在结果页');
            return;
        }
        try {
            cloneAndReformat();
            console.log('Calling window.print()');
            window.print();
        } catch (e) {
            console.error('Print error:', e);
            alert('打印出错: ' + e.message);
        }
    }
    
    // 初始化
    function init() {
        console.log('Initializing print card...');
        
        addPrintStyles();
        createPrintContainer();
        const btn = createPrintButton();
        
        const observer = new MutationObserver(() => {
            if (isResultPage()) {
                btn.style.display = 'block';
            } else {
                btn.style.display = 'none';
            }
        });
        
        observer.observe(document.body, { subtree: true, childList: true });
        
        if (isResultPage()) {
            btn.style.display = 'block';
        }
        
        console.log('Print card initialized');
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(init, 3000));
    } else {
        setTimeout(init, 3000);
    }
})();