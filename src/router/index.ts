import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/time',
    },
    {
      path: '/time',
      name: 'time',
      component: () => import('../views/TimeManagementView.vue'),
      meta: { title: '时间管理' },
    },
    {
      path: '/daily',
      name: 'daily',
      component: () => import('../views/DailyRecordView.vue'),
      meta: { title: '日常记录' },
    },
    {
      path: '/daily-stars',
      name: 'daily-stars',
      component: () => import('../views/DailyStarsView.vue'),
      meta: { title: '日常星级' },
    },
    {
      path: '/study',
      name: 'study',
      component: () => import('../views/StudyRecordView.vue'),
      meta: { title: '学习记录' },
    },
    {
      path: '/logs',
      name: 'logs',
      component: () => import('../views/LogView.vue'),
      meta: { title: '查看日志' },
    },
    {
      path: '/pause',
      name: 'pause',
      component: () => import('../views/PausePeriodView.vue'),
      meta: { title: '休整日' },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
      meta: { title: '设置' },
    },
    {
      path: '/progress',
      redirect: '/daily',
    },
  ],
})

export default router
