import { createRouter, createWebHashHistory } from "vue-router";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/onboarding",
      name: "onboarding",
      component: () => import("@/pages/Onboarding.vue"),
    },
    {
      path: "/agreement-update",
      name: "agreement-update",
      component: () => import("@/pages/AgreementUpdate.vue"),
    },
    {
      path: "/",
      component: () => import("@/layouts/MainLayout.vue"),
      children: [
        {
          path: "",
          name: "home",
          component: () => import("@/pages/Home.vue"),
        },
        {
          path: "library",
          name: "library",
          component: () => import("@/pages/Library.vue"),
        },
        {
          path: "liked",
          name: "liked",
          component: () => import("@/pages/Liked.vue"),
        },
        {
          path: "history",
          name: "history",
          component: () => import("@/pages/History.vue"),
        },
        {
          path: "collection/:source/:type/:id",
          name: "collection",
          component: () => import("@/pages/Collection.vue"),
        },
        {
          path: "artist/:source/:id",
          name: "artist",
          component: () => import("@/pages/Artist.vue"),
        },
        {
          path: "artists/local",
          name: "artist-list",
          component: () => import("@/pages/LocalList.vue"),
        },
        {
          path: "albums/local",
          name: "album-list",
          component: () => import("@/pages/LocalList.vue"),
        },
        {
          path: "genres/local",
          name: "genre-list",
          component: () => import("@/pages/LocalList.vue"),
        },
        {
          path: "genres/local/unknown",
          name: "unknown-genre",
          component: () => import("@/pages/LocalList.vue"),
        },
        { path: "years/local", name: "year-list", component: () => import("@/pages/Years.vue") },
        { path: "years/local/:year", name: "year", component: () => import("@/pages/Years.vue") },
        {
          path: "folders",
          name: "folders",
          component: () => import("@/pages/Folders.vue"),
        },
        {
          path: "stats",
          name: "stats",
          redirect: "/",
        },
        {
          path: "search",
          name: "search",
          component: () => import("@/pages/Search.vue"),
        },
        {
          path: "streaming",
          component: () => import("@/pages/Streaming/Index.vue"),
          redirect: "/streaming/songs",
          children: [
            {
              path: "songs",
              name: "streaming-songs",
              component: () => import("@/pages/Streaming/Songs.vue"),
            },
            {
              path: "albums",
              name: "streaming-albums",
              component: () => import("@/pages/Streaming/Albums.vue"),
            },
            {
              path: "artists",
              name: "streaming-artists",
              component: () => import("@/pages/Streaming/Artists.vue"),
            },
            {
              path: "playlists",
              name: "streaming-playlists",
              component: () => import("@/pages/Streaming/Playlists.vue"),
            },
          ],
        },
      ],
    },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

router.beforeEach((to) => {
  if (
    (to.name === "artist" || to.name === "collection") &&
    to.params.source !== "local" &&
    to.params.source !== "streaming"
  )
    return { name: "home" };
  return true;
});

export default router;
