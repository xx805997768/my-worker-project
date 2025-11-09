// 默认网址列表
const defaultSites = [
    {name: 'Google', url: 'https://www.google.com/'},
    {name: 'YouTube', url: 'https://www.youtube.com/'},
    {name: 'Cloudflare', url: 'https://www.cloudflare.com/'},
    {name: 'GitHub', url: 'https://github.com/'},
    {name: 'ChatGPT', url: 'https://chat.openai.com/'},
    {name: 'Copilot', url: 'https://github.com/features/copilot'},
    {name: 'Freepass AI', url: 'https://freepass.ai/'},
    {name: 'IT狗', url: 'https://www.itdog.cn/'},
    {name: 'Fast.com', url: 'https://fast.com/'},
    {name: 'Google Fiber Speedtest', url: 'https://fiber.google.com/speedtest/'},
    {name: 'Speedtest.net', url: 'https://www.speedtest.net/'},
];
function loadSites() {
    const saved = localStorage.getItem('mySites');
    return saved ? JSON.parse(saved) : defaultSites.slice();
}
let sites = loadSites();
function saveSites() {
    localStorage.setItem('mySites', JSON.stringify(sites));
}
function getIcon(site) {
    const name = site.name.toLowerCase();
    const url = site.url;
    if( name.includes('google fiber') || url.includes('fiber.google.com') ) {
        return '<i class="fa-solid fa-bolt fa-fw" style="color: #fbbc04"></i>';
    }
    if( name.includes('google') ) {
        return '<i class="fab fa-google fa-fw" style="color: #4285F4"></i>';
    }
    if( name.includes('youtube') || url.includes('youtube.com') ) {
        return '<i class="fab fa-youtube fa-fw" style="color: #FF0000"></i>';
    }
    if( name.includes('cloudflare') || url.includes('cloudflare.com') ) {
        return '<i class="fab fa-cloudflare fa-fw" style="color: #f38020"></i>';
    }
    if( name.includes('github copilot') || name.includes('copilot') ) {
        return '<i class="fa-solid fa-code fa-fw" style="color: #3b49df"></i>';
    }
    if( name.includes('github') || url.includes('github.com') ) {
        return '<i class="fab fa-github fa-fw" style="color: #24292F"></i>';
    }
    if( name.includes('chatgpt') || url.includes('openai.com') ) {
        return '<i class="fa-solid fa-robot fa-fw" style="color: #19c37d"></i>';
    }
    if( name.includes('freepass') ) {
        return '<i class="fa-solid fa-passport fa-fw" style="color: #e4be4d"></i>';
    }
    if( name.includes('it狗') || url.includes('itdog.cn') ) {
        return '<i class="fa-solid fa-dog fa-fw" style="color: #47b881"></i>';
    }
    if( name.includes('fast') ) {
        return '<i class="fa-solid fa
