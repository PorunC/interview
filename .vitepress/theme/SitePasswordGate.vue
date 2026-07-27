<script setup lang="ts">
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "@lucide/vue";
import { nextTick, onMounted, ref } from "vue";
import { withBase } from "vitepress";

// The default is only a convenience for this lightweight, client-side gate.
// Set VITE_SITE_PASSWORD_HASH during the build to replace it without committing a new hash.
const DEFAULT_PASSWORD_HASH = "615ed7fb1504b0c724a296d7a69e6c7b2f9ea2c57c1d8206c5afdf392ebdfd25";
const configuredHash = String(import.meta.env.VITE_SITE_PASSWORD_HASH || "").trim().toLowerCase();
const passwordHash = configuredHash || DEFAULT_PASSWORD_HASH;
const storageKey = `interview-site-access:${passwordHash.slice(0, 16)}`;

const password = ref("");
const error = ref("");
const isSubmitting = ref(false);
const showPassword = ref(false);
const isAuthenticated = ref(false);
const passwordInput = ref<HTMLInputElement>();

async function hashPassword(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function unlock() {
  if (isSubmitting.value || !password.value) return;

  isSubmitting.value = true;
  error.value = "";

  try {
    const matches = (await hashPassword(password.value)) === passwordHash;
    if (!matches) {
      error.value = "密码不正确";
      password.value = "";
      await nextTick(() => passwordInput.value?.focus());
      return;
    }

    window.localStorage.setItem(storageKey, passwordHash);
    isAuthenticated.value = true;
  } catch {
    error.value = "当前浏览器不支持密码校验，请更换浏览器";
  } finally {
    isSubmitting.value = false;
  }
}

onMounted(() => {
  try {
    isAuthenticated.value = window.localStorage.getItem(storageKey) === passwordHash;
  } catch {
    isAuthenticated.value = false;
  }

  if (!isAuthenticated.value) passwordInput.value?.focus();
});
</script>

<template>
  <div :inert="isAuthenticated ? undefined : true" :aria-hidden="isAuthenticated ? undefined : 'true'">
    <slot />
  </div>
  <main v-if="!isAuthenticated" class="site-gate" aria-labelledby="site-gate-title">
    <section class="site-gate__panel">
      <a class="site-gate__brand" :href="withBase('/')" aria-label="返回面试资料库首页">
        <img :src="withBase('/mark.svg')" alt="" width="38" height="38" />
        <span>面试资料库</span>
      </a>
      <div class="site-gate__icon" aria-hidden="true">
        <LockKeyhole :size="24" />
      </div>
      <h1 id="site-gate-title">输入访问密码</h1>
      <p class="site-gate__hint">Interview Knowledge Base</p>
      <form class="site-gate__form" @submit.prevent="unlock">
        <label class="site-gate__field">
          <span class="sr-only">访问密码</span>
          <input
            ref="passwordInput"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            placeholder="访问密码"
            :aria-invalid="Boolean(error)"
            :aria-describedby="error ? 'site-gate-error' : undefined"
          />
          <button
            type="button"
            class="site-gate__toggle"
            :title="showPassword ? '隐藏密码' : '显示密码'"
            :aria-label="showPassword ? '隐藏密码' : '显示密码'"
            @click="showPassword = !showPassword"
          >
            <EyeOff v-if="showPassword" :size="18" aria-hidden="true" />
            <Eye v-else :size="18" aria-hidden="true" />
          </button>
        </label>
        <button class="site-gate__submit" type="submit" :disabled="isSubmitting || !password">
          <span>{{ isSubmitting ? "校验中" : "进入资料库" }}</span>
          <ArrowRight :size="18" aria-hidden="true" />
        </button>
      </form>
      <p v-if="error" id="site-gate-error" class="site-gate__error" role="alert">{{ error }}</p>
    </section>
  </main>
</template>

<style scoped>
.site-gate {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: grid;
  min-height: 100dvh;
  place-items: center;
  padding: 24px;
  overflow: auto;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
}

.site-gate::before {
  position: fixed;
  inset: 0 auto 0 0;
  width: min(24vw, 320px);
  background: var(--vp-c-brand-1);
  content: "";
  opacity: 0.08;
  pointer-events: none;
}

.site-gate__panel {
  position: relative;
  box-sizing: border-box;
  width: min(100%, 420px);
  padding: 40px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-elv);
  box-shadow: 0 18px 50px rgba(24, 35, 33, 0.1);
}

.site-gate__brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--vp-c-text-1);
  font-size: 15px;
  font-weight: 700;
  text-decoration: none;
}

.site-gate__brand img {
  display: block;
}

.site-gate__icon {
  display: grid;
  width: 48px;
  height: 48px;
  margin-top: 48px;
  place-items: center;
  border-radius: 50%;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.site-gate h1 {
  margin: 18px 0 6px;
  font-size: 26px;
  line-height: 1.25;
}

.site-gate__hint {
  margin: 0 0 26px;
  color: var(--vp-c-text-3);
  font-size: 13px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.site-gate__form {
  display: grid;
  gap: 10px;
}

.site-gate__field {
  position: relative;
  display: block;
}

.site-gate__field input {
  box-sizing: border-box;
  width: 100%;
  height: 46px;
  padding: 0 44px 0 14px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 5px;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  font: inherit;
  outline: none;
}

.site-gate__field input:focus {
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 0 0 3px var(--vp-c-brand-soft);
}

.site-gate__toggle {
  position: absolute;
  top: 50%;
  right: 6px;
  display: grid;
  width: 34px;
  height: 34px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 4px;
  color: var(--vp-c-text-3);
  background: transparent;
  cursor: pointer;
  transform: translateY(-50%);
}

.site-gate__toggle:hover,
.site-gate__toggle:focus-visible {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.site-gate__toggle:focus-visible,
.site-gate__submit:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.site-gate__submit {
  display: inline-flex;
  height: 46px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  border-radius: 5px;
  color: #fff;
  background: var(--vp-c-brand-1);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.site-gate__submit:hover:not(:disabled) {
  background: var(--vp-c-brand-2);
}

.site-gate__submit:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.site-gate__error {
  margin: 12px 0 0;
  color: #b42318;
  font-size: 13px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 560px) {
  .site-gate {
    padding: 16px;
  }

  .site-gate__panel {
    padding: 28px 24px;
  }

  .site-gate__icon {
    margin-top: 36px;
  }
}
</style>
