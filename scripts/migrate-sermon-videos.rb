#!/usr/bin/env ruby

require "json"
require "open3"
require "thread"

catalog_path = File.expand_path(ARGV[0] || "content/sermons.json")
worker_count = Integer(ARGV[1] || 8)
catalog = JSON.parse(File.read(catalog_path))
sermons = catalog.fetch("sermons")
queue = Queue.new
sermons.each { |sermon| queue << sermon }
worker_count.times { queue << nil }

mutex = Mutex.new
completed = 0
found = 0
failed = []

workers = worker_count.times.map do
  Thread.new do
    while (sermon = queue.pop)
      html, status = Open3.capture2(
        "curl", "-4", "--http1.1", "--compressed", "-A", "Mozilla/5.0",
        "-L", "--connect-timeout", "15", "--max-time", "120", "-sS",
        sermon.fetch("sourceUrl")
      )

      youtube_id = if status.success?
        html.force_encoding(Encoding::UTF_8).scrub!
        html[%r{youtube(?:-nocookie)?\.com/embed/([A-Za-z0-9_-]{6,})}i, 1]
      end
      sermon["youtubeId"] = youtube_id || "" if status.success?

      mutex.synchronize do
        completed += 1
        found += 1 unless sermon.fetch("youtubeId", "").empty?
        failed << sermon.fetch("sourceUrl") unless status.success?
        warn "Checked #{completed}/#{sermons.length}; found #{found} videos" if (completed % 25).zero?
      end
    end
  end
end

workers.each(&:join)
File.write(catalog_path, JSON.pretty_generate(catalog) + "\n")

puts "Added YouTube IDs to #{found} of #{sermons.length} sermons."
puts "#{sermons.count { |sermon| sermon.fetch("youtubeId", "").empty? }} sermons have no YouTube embed."
warn "#{failed.length} pages could not be downloaded." unless failed.empty?
