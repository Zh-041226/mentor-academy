Page({
  data: {
    url: ''
  },
  onLoad(query) {
    const u = decodeURIComponent(query.url || '');
    this.setData({ url: u });
  }
});