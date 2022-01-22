# frozen_string_literal: true

# name: discourse-performance-tool
# about: Tools for measuring client-side performance
# version: 1.0
# author: David Taylor
# url: https://github.com/davidtaylorhq/discourse-performance-tool
# transpile_js: true

enabled_site_setting :performance_tool_enabled

register_html_builder('server:before-head-close') do |controller|
  src = submit_script_url = UrlHelper.absolute("#{Discourse.base_path}/plugins/discourse-performance-tool/javascripts/discourse-performance-tool.js", GlobalSetting.cdn_url)
  "<script async src=#{src}></script>"
end
