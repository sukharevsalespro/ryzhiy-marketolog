/* Formula: pause on touch/keyboard and while outside the viewport. */
(function(){
const box=document.querySelector('.w-formula'),q=matchMedia('(prefers-reduced-motion: reduce)'),button=box.querySelector('button');
button.onclick=()=>{const paused=box.classList.toggle('paused');button.setAttribute('aria-pressed',paused);button.textContent=paused?'Продолжить':'Пауза';button.setAttribute('aria-label',paused?'Продолжить бегущую строку':'Приостановить бегущую строку')};
function sync(){box.classList.toggle('marquee',!q.matches)}sync();q.addEventListener('change',sync);
if(window.IntersectionObserver)new IntersectionObserver(es=>es.forEach(e=>box.classList.toggle('in-view',e.isIntersecting))).observe(box);
})();
