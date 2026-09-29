// 截图功能 - 长按保存结果页
(function() {
    'use strict';
    
    console.log('Screenshot script loading...');
    
    // 等待页面加载完成
    function init() {
        console.log('Initializing screenshot...');
        
        // 查找保存按钮（使用多种选择器）
        const saveButton = document.querySelector('button[class*="flex-1"]') || 
                          Array.from(document.querySelectorAll('button')).find(b => 
                              b.textContent.includes('保存') || 
                              b.textContent.includes('截图')
                          );
        
        // 查找截图目标（结果页容器）
        const screenshotTarget = document.querySelector('[class*="ResultPage"]') ||
                                  document.querySelector('main') ||
                                  document.querySelector('#root > div > div:last-child');
        
        console.log('Save button:', saveButton ? 'Found' : 'Not found');
        console.log('Screenshot target:', screenshotTarget ? 'Found' : 'Not found');
        
        if (!saveButton || !screenshotTarget) {
            console.warn('Elements not found, retrying in 2s...');
            setTimeout(init, 2000);
            return;
        }
        
        // 检查 html2canvas
        if (!window.html2canvas) {
            console.warn('html2canvas not loaded, retrying in 2s...');
            setTimeout(init, 2000);
            return;
        }
        
        console.log('All resources ready, attaching events...');
        
        let pressTimer;
        const longPressDuration = 800;
        
        const startPress = (e) => {
            if (e.type === 'touchstart') {
                e.preventDefault();
            }
            
            saveButton.style.transform = 'scale(0.95)';
            saveButton.style.opacity = '0.8';
            
            pressTimer = setTimeout(() => {
                saveButton.style.transform = '';
                saveButton.style.opacity = '';
                
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
                
                console.log('Long press detected!');
                takeScreenshot();
            }, longPressDuration);
        };
        
        const cancelPress = () => {
            clearTimeout(pressTimer);
            saveButton.style.transform = '';
            saveButton.style.opacity = '';
        };
        
        // 添加事件监听
        saveButton.addEventListener('touchstart', startPress, { passive: false });
        saveButton.addEventListener('touchend', cancelPress);
        saveButton.addEventListener('touchcancel', cancelPress);
        saveButton.addEventListener('mousedown', startPress);
        saveButton.addEventListener('mouseup', cancelPress);
        saveButton.addEventListener('mouseleave', cancelPress);
        
        console.log('Events attached successfully');
        
        const takeScreenshot = () => {
            console.log('Taking screenshot...');
            
            if (!window.html2canvas) {
                alert('截图功能加载中，请稍后再试');
                return;
            }
            
            // 显示加载提示
            const toast = document.createElement('div');
            toast.textContent = '正在生成高清图片...';
            toast.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.8);color:white;padding:20px 30px;border-radius:10px;z-index:9999;font-size:16px;';
            document.body.appendChild(toast);
            
            // 使用 html2canvas 自动计算尺寸，避免拉伸
            html2canvas(screenshotTarget, {
                useCORS: true,
                scale: 2, // 2x 高清
                logging: true,
                allowTaint: true,
                backgroundColor: '#F7F5F0',
                imageTimeout: 20000,
                // 不设置 width/height，让 html2canvas 自动计算
                onclone: (clonedDoc) => {
                    // 移除所有边框和阴影
                    const allElements = clonedDoc.querySelectorAll('*');
                    allElements.forEach(el => {
                        el.style.border = 'none';
                        el.style.boxShadow = 'none';
                        el.style.outline = 'none';
                    });
                    
                    // 优化图片
                    const images = clonedDoc.querySelectorAll('img');
                    images.forEach(img => {
                        img.crossOrigin = 'anonymous';
                        img.style.maxWidth = '100%';
                        img.style.height = 'auto';
                    });
                }
            }).then(canvas => {
                document.body.removeChild(toast);
                
                // 使用 PNG 保证质量
                const dataUrl = canvas.toDataURL('image/png');
                
                const link = document.createElement('a');
                link.download = `五行纳音-${new Date().getTime()}.png`;
                link.href = dataUrl;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                console.log('Screenshot saved! Size:', canvas.width, 'x', canvas.height);
            }).catch(error => {
                document.body.removeChild(toast);
                console.error('Screenshot failed:', error);
                alert('截图失败: ' + error.message);
            });
        };
    }
    
    // 延迟初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(init, 2000));
    } else {
        setTimeout(init, 2000);
    }
})();