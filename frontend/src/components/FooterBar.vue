<template>
  <!-- 固定底部条：仅在滚动到页面最底部附近时显示 -->
  <footer :class="['footer', { show: visible }]" role="contentinfo" aria-label="站点页脚">
    <div class="footer-inner">
      <span class="copyright">© 崇德书院创新实践部. 保留所有权利.</span>
      <span class="sep" aria-hidden="true">·</span>
      <span class="item">
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6.62 10.79a15.053 15.053 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.05-.24c1.12.37 2.33.57 3.54.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C11.4 21 3 12.6 3 3a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.21.2 2.42.57 3.54a1 1 0 0 1-.24 1.05l-2.21 2.2Z" fill="currentColor"></path>
        </svg>
        <span>电话：</span>
        <a class="link-sunset" href="tel:00000000000">00000000000</a>
      </span>
      <span class="sep" aria-hidden="true">·</span>
      <span class="item">
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6Zm2 .5 8 5 8-5V6H4v.5Zm0 2.62V18h16V9.12l-8 5-8-5Z" fill="currentColor"></path>
        </svg>
        <span>邮箱：</span>
        <a class="link-sunset" href="mailto:contact@example.com">contact@example.com</a>
      </span>
    </div>
  </footer>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'

// 是否显示页脚：当滚动到底部附近时显示
const visible = ref(false)
const THRESHOLD = 24 // 距离底部 24px 内即显示

const updateVisibility = () => {
  const scrollY = window.scrollY || document.documentElement.scrollTop || 0
  const viewport = window.innerHeight || document.documentElement.clientHeight
  const full = document.documentElement.scrollHeight
  visible.value = scrollY + viewport >= full - THRESHOLD
}

onMounted(() => {
  updateVisibility()
  window.addEventListener('scroll', updateVisibility, { passive: true })
  window.addEventListener('resize', updateVisibility, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateVisibility)
  window.removeEventListener('resize', updateVisibility)
})

// 显示时给 body 增加类，避免条幅覆盖页面底部内容
watch(visible, (val) => {
  document.body.classList.toggle('footer-visible', !!val)
})
</script>

<style scoped>
/* 固定在视窗底部，左右与底部顶到边缘；默认隐藏，接近底部时滑入 */
.footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  width: 100vw;
  color: #fff;
  /* 与导航栏严格一致的渐变：底部较实，顶部较透，形成自然衔接 */
  background: linear-gradient(
    0deg, /* 0deg 从下往上，与导航条的 180deg 形成镜像 */
    rgba(190, 150, 90, 0.80) 0%,   /* 底部较实，同导航条顶部 */
    rgba(214, 186, 132, 0.50) 50%, /* 中段过渡 */
    rgba(231, 210, 168, 0.15) 100% /* 顶部更透明，同导航条底部 */
  );
  box-shadow: none; /* 与导航栏一致，无阴影 */
  border-top: 1px solid rgba(255, 255, 255, 0.12); /* 保留一个极淡的顶部描边以区分内容区 */
  transform: translateY(100%);
  opacity: 0;
  transition: transform 240ms ease, opacity 240ms ease;
  pointer-events: none; /* 隐藏时不拦截事件 */
}
.footer.show {
  transform: translateY(0%);
  opacity: 1;
  pointer-events: auto; /* 显示时可交互 */
}

.footer-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 12px 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  flex-wrap: wrap;
  font-size: 14px;
}
.copyright { opacity: 0.9; }
.sep { opacity: 0.45; }
.item { display: inline-flex; align-items: center; gap: 6px; }
.icon { width: 16px; height: 16px; color: #fff; opacity: 0.8; } /* 图标颜色改为与文字一致的白色 */

/* 质感链接：落日色渐变与下划线动画 */
.link-sunset {
  position: relative;
  font-weight: 700;
  text-decoration: none;
  background: linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.35), 0 2px 6px rgba(255, 126, 95, 0.25);
  transition: filter 0.2s ease, text-shadow 0.2s ease;
}
.link-sunset::after {
  content: '';
  position: absolute;
  left: 0; bottom: -2px;
  height: 2px; width: 100%;
  background: linear-gradient(90deg, #ff7e5f 0%, #feb47b 100%);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.22s ease;
}
.link-sunset:hover { filter: brightness(1.08); text-shadow: 0 1px 0 rgba(255,255,255,0.5), 0 4px 10px rgba(255,126,95,0.35); }
.link-sunset:hover::after { transform: scaleX(1); }
.link-sunset:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(255, 126, 95, 0.30);
  border-radius: 4px;
}

@media (max-width: 768px) {
  .footer-inner { padding: 10px 12px; font-size: 13px; gap: 10px; }
  .icon { width: 15px; height: 15px; }
}
</style>