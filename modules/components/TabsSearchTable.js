
// TabsSearchTable - NativeTable version
// Replaces layui.table usage with NativeTable component
// Exports a Vue options object compatible with your existing setup.
// Assumes `NativeTable` is available (import or global) and utilities `Global`, `g`, `config`, `layer` exist.
import Global from '../../utils/global.js'

//判断性刷新index
let credentialsValid = true;
let remember = localStorage.getItem('remember');
if (!remember || remember.split(",").length != 5) {
  credentialsValid = false;
  setTimeout(() => window.location.href = '/login.html', 1500);
}

if (!credentialsValid) {
  console.warn("登录凭据无效,跳转login:", remember);
  throw new Error('登录凭据无效,跳转login');
};
/*全局对象实例化*/
var g = new Global({ remember });

import { NativeTable } from './NativeTable.js'
export const TabsSearchTable = {
  name: "TabsSearchTable",
  components: {
    NativeTable
  },
  emits: ['master-guid-change'],
  props: {
    renderData: { type: Array, required: true },
    masterGuid: { type: String, default: '' }
  },

  data() {
    return {
      currTabIdx: 0,
      tabs: [],                 // each tab will contain: xGUID, label, searchFields, columns, tableData, loading, pagination, selectedId, tableConfig
      searchFormData: {},
      showLayer: false,
      layerFormData: {},
      layerTargetNode: null,
      layerMode: 'form',
      externalParams: {}
    };
  },

  watch: {
    masterGuid(newVal) {
      this.externalParams = { ...this.externalParams, MasterGUID: newVal };
      // masterGuid 为空就不请求
      if (!newVal) {
        return;
      }
      this.reloadTable(this.currTabIdx);
    }
  },

  computed: {
    adaptRenderData() {
      if (!Array.isArray(this.renderData)) return [];
      if (this.renderData[0]?.xCategory !== 'filter') {
        let filterArr = [];
        this.renderData.forEach(item => {
          if (item.xCategory === 'table') {
            let filter = {
              xGUID: this.renderData[0]?.xParentGUID,
              xCaption: '搜索',
              xCategory: 'filter',
              xChilds: [item]
            };
            filterArr.push(filter);
          }
        });
        return filterArr;
      } else {
        return this.renderData;
      }
    },
    indicatorStyle() {
      const header = this.$el?.querySelector('.adv-tabs-header');
      if (!header) return {};

      const li = header.children[this.currTabIdx];
      if (!li) return {};

      return {
        left: li.offsetLeft + 'px',
        width: li.offsetWidth + 'px'
      };
    }
  },

  methods: {
    initTabs() {
      if (!Array.isArray(this.adaptRenderData)) return;
      const tabs = [];
      this.adaptRenderData.forEach(item => {
        if (item.xCategory === 'filter' && item.xChilds.length > 0) {
          item.xChilds.forEach(child => {
            if (child.xCategory === 'table') {
              // build search fields (exclude nested tables)
              let _searchFields = Global.filterTree(this.adaptRenderData, { xParentGUID: this.adaptRenderData[0].xGUID });
              _searchFields = Global.excludeSubtree(_searchFields, node => node.xCategory === 'table');
              _searchFields.forEach(f => {
                if (f.xType === 'select') f.xOptions = Global.tryParse(f.xOptions);
              });

              const tab = {
                xGUID: child.xGUID,
                label: child.xCaption,
                searchFields: _searchFields,
                columns: Global.filterTree(this.adaptRenderData, { xParentGUID: child.xGUID }),
                tableData: [],
                loading: false,
                pagination: { curr: 1, limit: 10, total: 0, show: true },
                selectedId: '',
                tableConfig: {}
              };

              // set default search values
              const defaultValues = this.getDefaultFormValues(tab.searchFields);
              this.searchFormData = { ...this.searchFormData, ...defaultValues };
              tabs.push(tab);
            }
          });
        }
      });
      this.tabs = tabs;
    },

    // convert node list -> columns used by NativeTable (keeps original nodes for actions)
    convertToNativeColumns(tableDetailNodes) {
      return tableDetailNodes.map(f => ({
        xGUID: f.xGUID,
        xCategory: f.xCategory,
        xCaption: f.xCaption,
        xCode: f.xCode,
        xType: f.xType,
        xVisiable: f.xVisiable,
        xWidth: f.xWidth,
        xTargetID: f.xTargetID
      }));
    },

    // build action button nodes (used by NativeTable)
    getActionBtnsFromColumns(cols) {
      return cols.filter(c => c.xCategory === 'action' || c.xType === '_Showlayer' || c.xType === '_Delete');
    },

    // Search button clicked
    onSearchGroupBtnClick(btnNode, tabIndex) {
      const action = btnNode.xType;
      if (action === '_Search') {
        // reset to first page
        const tab = this.tabs[tabIndex];
        tab.pagination.curr = 1;
        this.reloadTable(tabIndex);
      } else if (action === '_Showlayer' || action === 'AddNew') {
        let rawTargetID = btnNode.xTargetID;
        if (!rawTargetID) {
          console.warn("按钮缺少 xTargetID 配置");
          return;
        }
        let targetID = rawTargetID.includes('_') ? rawTargetID.split('_')[1] : rawTargetID;
        let targetObj = Global.filterTree(this.adaptRenderData, { xGUID: targetID }).find(f => f.xGUID === targetID);
        if (targetObj) {
          this.openLayerForm(targetObj, null);
        } else {
          console.warn(`未找到目标对象定义: ${targetID}`);
        }
      } else {
        console.warn("未处理的按钮类型:", action);
      }
    },

    // reload table data from server for a given tab index
    async reloadTable(tabIndex) {
      const idx = tabIndex !== undefined ? tabIndex : this.currTabIdx;
      const tab = this.tabs[idx];
      if (!tab) return;

      // if masterGUID dependency present and empty -> clear
      if (this.externalParams.hasOwnProperty('MasterGUID') && !this.externalParams.MasterGUID) {
        tab.tableData = [];
        tab.pagination.total = 0;
        return;
      }

      tab.loading = true;
      const payload = {
        ...this.searchFormData,
        ...this.externalParams,
        curr: tab.pagination.curr,
        limit: tab.pagination.limit
      };

      try {
        const reqOpts = {
          url: `/v2/ApiCommon/${tab.xGUID}`,
          data: JSON.stringify(payload)
        };
        const res = await g.request(reqOpts);
        tab.loading = false;
        if (res && res.code === 200) {
          const dt = res.data?.dt0 || [];
          // mark first as selected by default
          if (dt.length > 0) {
            tab.selectedId = dt[0].xGUID || '';
            // 只有一个tab且有搜索字段时，则认为主表,自动触发masterGuid变更,就会触发子表加载数据
            if(this.tabs.length === 1 && this.tabs[0]?.searchFields?.length > 0){
               this.$emit('master-guid-change', { masterGUID:tab.selectedId });
            }
          } else {
            tab.selectedId = '';
          }
          tab.tableData = dt;
          tab.pagination.total = res.data?.dt1?.[0]?.TotalRecords || dt.length;
        } else {
          tab.tableData = [];
          tab.pagination.total = 0;
          console.warn('reloadTable 返回异常', res);
        }
      } catch (err) {
        tab.loading = false;
        tab.tableData = [];
        tab.pagination.total = 0;
        console.warn(err);
      }
    },

    // External setter
    setExternalFilter(params) {
      this.externalParams = { ...this.externalParams, ...params };
      this.reloadTable(this.currTabIdx);
    },

    switchTab(index) {
      this.currTabIdx = index;
      const tab = this.tabs[index];
      // ensure page reset when switching
      tab.pagination.curr = 1;
      this.$nextTick(() => {
        this.reloadTable(index);
      });
    },

    // row clicked (from NativeTable)
    onRowClick(row) {
      const masterGUID = row.xGUID;
      const tab = this.tabs[this.currTabIdx];
      if (tab) {
        tab.selectedId = masterGUID;
      }
      //console.log('onRowClick', row);
      this.$emit('master-guid-change', { masterGUID });
    },

    // action button clicked in NativeTable
    onActionClick({ btnNode, row }) {
      const type = btnNode.xType;
      if (type === '_Showlayer') {
        let targetID = btnNode.xTargetID?.split('_')[1];
        let targetNode = Global.filterTree(this.adaptRenderData, { xGUID: targetID }).find(f => f.xGUID === targetID);
        if (!targetNode) {
          console.warn('未找到对应的目标对象详情数据');
          return;
        }
        this.openLayerForm(targetNode, row);
      } else if (type === '_Delete') {
        const virTargetNode = {
          xCaption: "删除确认",
          xSpan: 1,
          xWidth: 360,
          xChilds: [
            { xGUID: btnNode.xGUID, xCategory: "action", xType: "_Submit", xCaption: "确认", xSpan: 1 },
            { xGUID: "vir_cancel_id", xCategory: "action", xType: "_Cancel", xCaption: "取消", xSpan: 1 }
          ]
        };
        const payload = { xGUID: row.xGUID };
        this.openLayerForm(virTargetNode, payload, 'confirm');
      } else {
        console.warn("未知操作类型:", type);
      }
    },

    // page change emitted by NativeTable
    onPageChange({ curr, limit }) {
      const tab = this.tabs[this.currTabIdx];
      tab.pagination.curr = curr;
      tab.pagination.limit = limit;
      this.reloadTable(this.currTabIdx);
    },

    // Helpers
    getDefaultFormValues(searchFields) {
      const formJson = {};
      if (!Array.isArray(searchFields)) return formJson;
      searchFields.forEach(item => {
        if (item.xCategory !== 'detail') return;
        const key = item.xCode;
        let value = undefined;
        if (item.hasOwnProperty('xDefault') && item.xDefault) {
          value = item.xDefault;
        } else {
          switch ((item.xType || '').toLowerCase()) {
            case 'select':
              if (Array.isArray(item.xOptions) && item.xOptions.length > 0) value = item.xOptions[0];
              else value = '';
              break;
            case 'date':
              value = '';
              break;
            case 'number':
              value = '';
              break;
            default:
              value = '';
          }
        }
        formJson[key] = value === undefined ? '' : value;
      });
      return formJson;
    },

    getNumberStep(options) {
      if (options === null || options === undefined || options === '') return 'any';
      const precision = parseInt(options);
      if (isNaN(precision) || precision < 0) return 'any';
      if (precision === 0) return '1';
      return Math.pow(10, -precision).toString();
    },

    getLocalISOString() {
      const now = new Date();
      const offsetMs = now.getTimezoneOffset() * 60 * 1000;
      const localTime = new Date(now.getTime() - offsetMs);
      return localTime.toISOString().slice(0, 16);
    },

    openLayerForm(targetNode, rowData, mode = 'form') {
      this.layerTargetNode = targetNode;
      this.layerMode = mode;

      if (mode === 'confirm') {
        this.layerFormData = rowData || {};
        this.showLayer = true;
        return;
      }

      let _layerFormData = {};
      (targetNode.xChilds || []).forEach(f => {
        if (f.xCategory !== 'detail') return;
        if (f.xType === 'select') f.xOptions = Global.tryParse(f.xOptions);
        const key = f.xCode;
        let value = undefined;
        if (rowData && rowData[key] !== undefined && rowData[key] !== null) {
          if (f.xType === 'datetime-local' && typeof rowData[key] === 'string') {
            value = rowData[key].slice(0, 16);
          } else {
            value = rowData[key];
          }
        }
        if (value === undefined && f.hasOwnProperty('xDefault') && f.xDefault !== null) {
          if (f.xType === 'datetime-local' && (f.xDefault === 'now' || f.xDefault === 'CurrentTime')) {
            value = this.getLocalISOString();
          } else {
            value = f.xDefault;
          }
        }
        if (value === undefined) {
          switch ((f.xType || '').toLowerCase()) {
            case "number":
              value = "";
              break;
            case "checkbox":
              value = false;
              break;
            case "datetime-local":
              value = "";
              break;
            case "select":
              if (Array.isArray(f.xOptions) && f.xOptions.length > 0) value = f.xOptions[0];
              else value = "";
              break;
            default:
              value = "";
          }
        }
        _layerFormData[key] = value;
      });

      this.layerFormData = _layerFormData;
      this.showLayer = true;
    },

    closeLayer() {
      this.showLayer = false;
      this.layerTargetNode = null;
      this.layerFormData = {};
    },

    submitLayer(e) {
      let actguid = e.currentTarget.dataset.actguid;
      let actObj = (this.layerTargetNode?.xChilds || []).find(f => f.xGUID === actguid) || {};
      let payload = this.layerFormData;
      const reqOpts = {
        url: `v2/ApiCommon/${actObj.xGUID}`,
        data: JSON.stringify(payload)
      };
      g.request(reqOpts)
        .then(res => {
          if (res.code === 200) {
            layer.msg(this.layerMode === 'confirm' ? '操作成功' : '提交成功', { icon: 1 });
            this.reloadTable(this.currTabIdx);
            this.closeLayer();
          } else {
            layer.msg('操作失败:' + res.msg, { icon: 2 });
          }
        }).catch(err => {
          console.warn(err);
        });
    }
  },

  mounted() {
    this.initTabs();
    // initial load for first tab (if any)
    this.$nextTick(() => {
      // 如masterGuid 为空且没有搜索字段默认为子表，禁止加载
      if (this.masterGuid === "" && this.tabs[0]?.searchFields?.length === 0) return;
      if (this.tabs.length > 0) {
        this.reloadTable(0);
      }
    });
  },

  template: `
    <div class="tabs-search-table">
      <div class="adv-tabs">
         <ul class="adv-tabs-header">
          <li v-for="(tab,index) in tabs"
        :class="{'is-active': index === currTabIdx}"
        @click="switchTab(index)">
      {{ tab.label }}
    </li> <div class="adv-tabs-indicator"
         :style="indicatorStyle"></div>
  </ul>
        <div class="adv-tabs-body">
          <template v-for="(tab, index) in tabs" :key="index">
             <div  :class="['adv-tabs-item', { 'is-show': index === currTabIdx }]">
              <!-- 搜索区域 -->
              <form @submit.prevent>
                <div class="search-flex-container">
                  <div class="search-group-left">
                    <template v-for="item in tab.searchFields" :key="'L-'+item.xGUID">
                      <div v-if="item.xCategory==='detail' && item.xVisiable !== false" class="search-item">
                        <label :for="item.xGUID">{{item.xCaption}}<span v-if="item.xNotNull" style="color:red">*</span></label>

                        <input v-if="item.xType==='text'" :id="item.xGUID" type="text"
                          v-model="searchFormData[item.xCode]" :disabled="item.xEnable === false"
                          :required="item.xNotNull === true" :style="{width:item.xWidth?item.xWidth+'px':'auto' }" />

                        <input v-if="item.xType==='date'" :id="item.xGUID" type="date"
                          v-model="searchFormData[item.xCode]" :disabled="item.xEnable === false"
                          :required="item.xNotNull === true" :style="{width:item.xWidth?item.xWidth+'px':'auto' }" />

                        <select v-if="item.xType==='select'" :id="item.xGUID" v-model="searchFormData[item.xCode]"
                          :disabled="item.xEnable === false" :required="item.xNotNull === true"
                          :style="{width:item.xWidth?item.xWidth+'px':'auto' }">
                          <option v-for="opt in item.xOptions" :value="opt">{{ opt }}</option>
                        </select>
                      </div>

                      <input v-if="item.xCategory==='detail' && item.xVisiable === false" type="hidden"
                        :name="item.xCode" v-model="searchFormData[item.xCode]" />

                      <div v-if="item.xCategory==='action' && item.xType === '_Search'" class="search-item">
                        <button type="button" @click="onSearchGroupBtnClick(item, index)">{{item.xCaption}}</button>
                      </div>
                    </template>
                  </div>
                  <div class="search-group-right">
                    <template v-for="item in tab.searchFields" :key="'R-'+item.xGUID">
                      <div v-if="item.xCategory==='action' && item.xType !== '_Search'" class="search-item">
                        <button type="button" @click="onSearchGroupBtnClick(item, index)">{{item.xCaption}}</button>
                      </div>
                    </template>
                  </div>
                </div>
              </form>

              <!-- NativeTable -->
              <native-table
                :columns="convertToNativeColumns(tab.columns)"
                :data="tab.tableData"
                :selected-id="tab.selectedId"
                :pagination="tab.pagination"
                :loading="tab.loading"
                @row-click="onRowClick"
                @action-click="onActionClick"
                @page-change="onPageChange"
              />
            </div>
          </template>
        </div>
      </div>

      <!-- ========== 原生编辑弹框 ========== -->
      <div v-if="showLayer" class="native-layer-mask">
        <div class="native-layer-panel"
          :style="{width: layerTargetNode?.xWidth ? layerTargetNode.xWidth + 'px' : 'auto'}">

          <div class="native-layer-header">{{ layerTargetNode?.xCaption }}
            <span class="native-layer-close" @click="closeLayer">×</span>
          </div>

          <div class="native-layer-body">
            <form @submit.prevent class="layer-grid" :style="{'--cols': layerTargetNode?.xSpan || 1}">
              <template v-if="layerMode==='form'" v-for="item in layerTargetNode?.xChilds" :key="item.xGUID">
                <div v-if="item.xCategory==='detail' && item.xType !== '_PrimaryKey' && item.xVisiable !== false"
                  class="layer-item layer-span" :style="{'--span': item.xSpan || 1}">
                  <label>{{ item.xCaption }}<span v-if="item.xNotNull" style="color:red">*</span></label>

                  <input v-if="item.xType==='text'" type="text" v-model="layerFormData[item.xCode]"
                    :disabled="item.xEnable === false" :required="item.xNotNull === true" />

                  <input v-if="item.xType==='date'" type="date" v-model="layerFormData[item.xCode]"
                    :disabled="item.xEnable === false" :required="item.xNotNull === true" />

                  <select v-if="item.xType==='select'" v-model="layerFormData[item.xCode]"
                    :disabled="item.xEnable === false" :required="item.xNotNull === true">
                    <option v-for="opt in item.xOptions" :value="opt">{{ opt }}</option>
                  </select>

                  <input v-if="item.xType==='number'" type="number" v-model="layerFormData[item.xCode]"
                    :step="getNumberStep(item.xOptions)" :disabled="item.xEnable === false"
                    :required="item.xNotNull === true" />

                  <textarea v-if="item.xType==='textarea'" class="native-textarea" v-model="layerFormData[item.xCode]"
                    :disabled="item.xEnable === false" :required="item.xNotNull === true"></textarea>

                  <input v-if="item.xType==='datetime-local'" type="datetime-local" v-model="layerFormData[item.xCode]"
                    :disabled="item.xEnable === false" :required="item.xNotNull === true" />
                </div>

                <input v-if="item.xCategory==='detail' && item.xType !== '_PrimaryKey' && item.xVisiable === false"
                  type="hidden" v-model="layerFormData[item.xCode]" />
              </template>

              <template v-if="layerMode==='confirm'">
                <div style="margin-bottom:20px;">{{ layerTargetNode?.xCaption || "确认操作" }}</div>
                <div style="color:#666;margin-bottom:20px;">是否确定继续？</div>
              </template>

              <div class="layer-span layer-action" :style="{'--span': layerTargetNode?.xSpan || 1}">
                <template v-for="item in layerTargetNode?.xChilds" :key="item.xGUID">
                  <button v-if="item.xType==='_Submit'" type="button" class="layer-btn layer-btn-primary"
                    @click="submitLayer" :data-actguid="item.xGUID">{{ item.xCaption }}</button>
                  <button v-if="item.xType==='_Cancel'" type="button" class="layer-btn layer-btn-default"
                    @click="closeLayer">{{ item.xCaption }}</button>
                </template>
              </div>

            </form>
          </div>
        </div>
      </div>

    </div>
  `
};
