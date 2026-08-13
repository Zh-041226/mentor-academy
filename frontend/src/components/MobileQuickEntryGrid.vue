<script setup>
defineProps({
  items: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['select'])

function handleSelect(item) {
  emit('select', item)
}
</script>

<template>
  <div class="quick-entry-grid">
    <button
      v-for="item in items"
      :key="item.label"
      type="button"
      class="quick-entry-grid__item"
      @click="handleSelect(item)"
    >
      <span class="quick-entry-grid__icon">{{ item.shortLabel || item.label.slice(0, 2) }}</span>
      <span class="quick-entry-grid__label">{{ item.label }}</span>
      <span class="quick-entry-grid__desc">{{ item.desc }}</span>
    </button>
  </div>
</template>

<style scoped>
.quick-entry-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.quick-entry-grid__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 8px;
  border: none;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
  color: #0f172a;
}

.quick-entry-grid__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(255, 125, 115, 0.14), rgba(253, 186, 116, 0.24));
  color: #c2410c;
  font-size: 14px;
  font-weight: 800;
}

.quick-entry-grid__label {
  font-size: 13px;
  font-weight: 700;
}

.quick-entry-grid__desc {
  font-size: 11px;
  color: #94a3b8;
}
</style>
