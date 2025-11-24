// 注意：选项式 API 不需要引入 ref 或 onMounted，Vue 会自动处理
export const NativeTable = {
  name: 'NativeTable',
  // 1. Props 定义保持不变
  props: {
    columns: {
      type: Array,
      default: () => []
    },
    data: {
      type: Array,
      default: () => []
    },
    selectedId: {
      type: String,
      default: ''
    },
    loading: {
      type: Boolean,
      default: false
    },
    pagination: {
      type: Object,
      default: () => ({
        curr: 1,      // 当前页码
        limit: 10,    // 每页条数
        total: 0,     // 总条数
        show: true    // 是否显示分页栏
      })
    }
  },
  emits: ['page-change', 'row-click', 'action-click'],

  // 2. data() 替代 ref 定义响应式数据
  data() {
    return {
      gutterWidth: 0 // 滚动条宽度
    };
  },
  // ======== 新增 Computed 属性 ========
  computed: {
    // 计算属性：判断是否为最后一页
    isLastPage() {
      // total / limit 向上取整得到最大页数
      const maxPage = Math.ceil(this.pagination.total / this.pagination.limit);
      // 当前页码 >= 最大页码，则为最后一页
      return this.pagination.curr >= maxPage;
    },
    // 计算属性：判断是否有数据可以分页 (总数 > limit 才显示下一页)
    hasNextPage() {
      return this.pagination.total > this.pagination.limit * this.pagination.curr
    }
  },
  // 3. mounted() 替代 onMounted 钩子
  mounted() {
    this.gutterWidth = this.getScrollbarWidth();
  },

  // 4. methods 定义所有方法
  methods: {
    // 计算滚动条宽度
    getScrollbarWidth() {
      const outer = document.createElement('div');
      outer.style.visibility = 'hidden';
      outer.style.width = '100px';
      outer.style.msOverflowStyle = 'scrollbar';
      document.body.appendChild(outer);

      const widthNoScroll = outer.offsetWidth;
      // 强制显示滚动条
      outer.style.overflow = 'scroll';

      const inner = document.createElement('div');
      inner.style.width = '100%';
      outer.appendChild(inner);

      const widthWithScroll = inner.offsetWidth;
      outer.parentNode.removeChild(outer);

      return widthNoScroll - widthWithScroll;
    },

    // 判断是否为数据列
    isDataColumn(col) {
      return col.xCategory === 'detail' && col.xType !== '_PrimaryKey' && col.xVisiable !== false;
    },

    // 获取操作按钮
    getActionBtns() {
      return this.columns.filter(col => col.xCategory === 'action' || col.xType === '_Showlayer' || col.xType === '_Delete');
    },

    // 获取列样式
    getColStyle(col) {
      if (col.xWidth && col.xWidth > 0) return { width: col.xWidth + 'px', flex: 'none' };
      return { flex: 1, minWidth: '100px' };
    },

    // 处理行点击
    handleRowClick(row) {
      this.$emit('row-click', row);
    },

    // 处理按钮点击
    handleAction(btn, row, evt) {
      evt.stopPropagation();
      this.$emit('action-click', { btnNode: btn, row });
    },
        // 分页方法：通知父组件换页
    changePage(newPage) {
            // 内部防守逻辑 (虽然父组件会处理，但这里做一次快速检查)
      if (newPage < 1) return;
      const maxPage = Math.ceil(this.pagination.total / this.pagination.limit);
      if (newPage > maxPage) return;

      // 通知父组件：我想跳到 newPage，每页 limit 条
      this.$emit('page-change', {
        curr: newPage,
        limit: this.pagination.limit
      });
    }
  },

  // 5. Template 保持不变，可以直接使用 data 和 methods 中的属性（不需要 return）
  template: `
    <div class="native-table-wrapper">
      <div class="native-table-header">
        <div class="native-table-row header-row" :style="{ paddingRight: gutterWidth + 'px' }">
          <div class="native-table-cell fixed-width-50">#</div>
          
          <template v-for="col in columns" :key="col.xGUID">
            <div v-if="isDataColumn(col)"
                 class="native-table-cell" 
                 :style="getColStyle(col)">
              {{ col.xCaption }}
            </div>
          </template>

          <div v-if="getActionBtns().length > 0" class="native-table-cell action-column" style="width: 180px; flex: none;">
            操作
          </div>
        </div>
      </div>

      <div class="native-table-body">
        <div v-if="loading" class="loading-mask">
           <div class="spinner"></div> 数据加载中...
        </div>
        <div v-else-if="data.length === 0" class="empty-text">暂无数据</div>
        
        <div v-else v-for="(row, index) in data" :key="row.xGUID"
             class="native-table-row"
             :class="{ 'is-selected': row.xGUID === selectedId }"
             @click="handleRowClick(row)">
          
          <div class="native-table-cell fixed-width-50">{{ (pagination.curr - 1) * pagination.limit + index + 1 }}</div> 

          <template v-for="col in columns" :key="col.xGUID">
            <div v-if="isDataColumn(col)"
                 class="native-table-cell" 
                 :style="getColStyle(col)" 
                 :title="row[col.xCode]">
              {{ row[col.xCode] }}
            </div>
          </template>

          <div v-if="getActionBtns().length > 0" class="native-table-cell action-column" style="width: 180px; flex: none;">
             <button v-for="btn in getActionBtns()" :key="btn.xGUID"
                class="btn btn-xs"
                :class="{'btn-danger': btn.xType === '_Delete', 'btn-normal': btn.xType !== '_Delete'}"
                @click="handleAction(btn, row, $event)">
                {{ btn.xCaption }}
             </button>
          </div>
        </div>
      </div>
      
      <div class="native-table-footer" v-if="pagination.show && pagination.total > 0">
        <div class="page-info">
            共 {{ pagination.total }} 条，当前第 {{ pagination.curr }} 页 / {{ Math.ceil(pagination.total / pagination.limit) }} 页
        </div>
        <div class="page-btns">
            <button class="btn-primary" 
                    :disabled="pagination.curr <= 1" 
                    @click="changePage(pagination.curr - 1)">上一页</button>
            <span>{{ pagination.curr }}</span>
            <button class="btn-primary" 
                    :disabled="isLastPage" 
                    @click="changePage(pagination.curr + 1)">下一页</button>
        </div>
      </div>
      </div>
  `
};