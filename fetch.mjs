export class fetchingClass {
    constructor(url) {
      this.url = url;
    }
  
    load() {
      return import("node-fetch")
        .then((nodeFetch) => nodeFetch.default(this.url))
        .catch((e) => fetch(this.url));
    }
  
    fetching() {}
  }
  