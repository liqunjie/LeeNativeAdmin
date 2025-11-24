// 菜单导航组件(事件命名:子组件小写 暴露父级加- 父级事件大驼峰命名)
export const MenuNav = {
  name: 'MenuNav',
  props: {
    show: {
      type: Boolean,
      required: true
    },
    resdata: {
      type: Array,
      default: []
    }
  },

  // 子组件要修改 show，所以内部维护一份本地变量
  data() {
    return {
      locShow: this.show,
      searchText: '',
      debug: false
    }
  },
  emits: ['shade-close', 'nav-click'],
  watch: {
    // 父组件更新 show 时，自动同步到子组件本地副本
    show(val) {
      this.locShow = val;
    }
  },
  computed: {
    //计算属性字段
    filteredMenuData() {
      const search = this.searchText.trim().toLowerCase();
      if (!search) return this.resdata;

      return this.resdata
        .map(item => {
          const filteredChildren = item.xChilds.filter(child =>
            child.xCaption.toLowerCase().includes(search)
          );
          return { ...item, xChilds: filteredChildren };
        })
        .filter(item =>
          item.xCaption.toLowerCase().includes(search) ||
          item.xChilds.length > 0
        );
    }
  },
  methods: {
    // 关闭菜单（子修改自己 → emit通知父修改 props）
    shadeclose() {
      this.locShow = false;
      this.searchText = '';
      this.$emit('shade-close');

    },

    navclick(child) {
      console.log('子组件事件:', child);
      this.locShow = false;
      this.searchText = '';
      this.$emit('nav-click', child);

    },


  },

  template: `
    <div class="page-shade" data-prompt="MenuNav" @click="shadeclose" v-if="locShow"></div>

    <div class="page-menu" v-if="locShow">
      <div class="menu-search">
        <div class="menu-search-box">
          <input id="nav-search" :v-model="searchText"
            @input="searchText = $event.target.value"
            type="text" placeholder="请输入菜单关键字搜索…" 
            class="menu-search-input" />
          <i style="font-style: normal;">🔍</i> 
        </div>
      </div>

      <div class="menu-body">
        <div v-if="filteredMenuData.length === 0">暂无数据</div>

        <div v-else>
          <div v-for="item in filteredMenuData" :key="item.xGUID" class="menu-item">
            <div class="menu-title">{{item.xCaption}}</div>
            <ul class="menu-nav">
              <li v-for="child in item.xChilds" :key="child.xGUID"
                @click="navclick(child)">
                {{child.xCaption}}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `,
  // 生命周期钩子
  beforeCreate() {
    if (this.debug) console.log("01.实例初始化, beforeCreate阶段");
  },
  created() {
    if (this.debug) console.log("02.数据已初始化, created阶段");
  },
  beforeMount() {
    if (this.debug) console.log("03.挂载开始, beforeMount阶段");
  },
  mounted() {
    if (this.debug) console.log("04.挂载完成, mounted阶段");
  },
  beforeUpdate() {
    if (this.debug) console.log("05.数据更新前, beforeUpdate阶段");
  },
  updated() {
    if (this.debug) console.log("06.数据更新后, updated阶段");
  },
  beforeDestroy() {
    if (this.debug) console.log("07.实例销毁前, beforeDestroy阶段");
  },
  destroyed() {
    if (this.debug) console.log("08.实例销毁后, destroyed阶段");
  },
  /*加了这个组件用不了
  render() {
    if (this.debug) console.log("09.渲染前, render阶段");
  }, */
}