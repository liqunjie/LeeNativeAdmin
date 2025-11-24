export const SplitLayout = {
  name: 'SplitLayout',
  props: {
    mode: { // 布局方向：vertical(上下) / horizontal(左右)
      type: String,
      default: 'vertical' // vertical | horizontal
    },
    ratio: { // 两个区域的比例（百分比）
      type: Number,
      default: 50 // 0-100
    },
    min: { // 最小比例
      type: Number,
      default: 10
    },
    max: {
      type: Number,
      default: 90
    }
  },
  data() {
    return {
      dragging: false,
      currentRatio: this.ratio
    };
  },
  computed: {
    isVertical() {
      return this.mode === 'vertical';
    },
    containerStyle() {
      return {
        display: 'flex',
        width: '100%',
        height: '100%',
        flexDirection: this.isVertical ? 'column' : 'row'
      };
    },
    pane1Style() {
      return {
        flex: `0 0 ${this.currentRatio}%`,
        overflow: 'auto',
        transition: this.dragging ? 'none' : 'flex-basis 0.25s ease'
      };
    },
    pane2Style() {
      return {
        flex: `0 0 ${100 - this.currentRatio}%`,
        overflow: 'auto',
        transition: this.dragging ? 'none' : 'flex-basis 0.25s ease'
      };
    },
    splitterStyle() {
      return {
        flex: '0 0 6px',
        background: '#ddd',
        cursor: this.isVertical ? 'row-resize' : 'col-resize'
      };
    }
  },
  methods: {
    startDrag(e) {
      this.dragging = true;
      document.addEventListener('mousemove', this.onDrag);
      document.addEventListener('mouseup', this.stopDrag);
    },
    onDrag(e) {
      if (!this.dragging) return;

      const rect = this.$el.getBoundingClientRect();
      let newRatio;

      if (this.isVertical) {
        const offset = e.clientY - rect.top;
        newRatio = (offset / rect.height) * 100;
      } else {
        const offset = e.clientX - rect.left;
        newRatio = (offset / rect.width) * 100;
      }

      if (newRatio < this.min) newRatio = this.min;
      if (newRatio > this.max) newRatio = this.max;

      this.currentRatio = newRatio;
    },
    stopDrag() {
      this.dragging = false;
      document.removeEventListener('mousemove', this.onDrag);
      document.removeEventListener('mouseup', this.stopDrag);
    }
  },
  template: `
    <div :style="containerStyle">
      <div :style="pane1Style">
        <slot name="pane1"></slot>
      </div>

      <div :style="splitterStyle" @mousedown="startDrag"></div>

      <div :style="pane2Style">
        <slot name="pane2"></slot>
      </div>
    </div>
  `
};