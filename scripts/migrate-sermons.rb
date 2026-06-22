#!/usr/bin/env ruby

require "cgi"
require "date"
require "fileutils"
require "json"
require "rexml/document"

feed_directory = ARGV[0] || "/tmp"
output_path = File.expand_path(ARGV[1] || "content/sermons.json")
feed_files = Dir.glob(File.join(feed_directory, "grasso-feed*.xml")).sort_by do |filename|
  File.basename(filename)[/-(\d+)\.xml$/, 1]&.to_i || 1
end

books = [
  "Song of Solomon", "1 Thessalonians", "2 Thessalonians", "1 Corinthians", "2 Corinthians",
  "1 Chronicles", "2 Chronicles", "Deuteronomy", "Ecclesiastes", "Lamentations", "Philippians",
  "Colossians", "Revelation", "1 Samuel", "2 Samuel", "1 Timothy", "2 Timothy", "1 Peter", "2 Peter",
  "1 Kings", "2 Kings", "1 John", "2 John", "3 John", "Leviticus", "Numbers", "Joshua", "Judges",
  "Nehemiah", "Esther", "Psalms", "Proverbs", "Isaiah", "Jeremiah", "Ezekiel", "Daniel", "Hosea",
  "Obadiah", "Habakkuk", "Zephaniah", "Zechariah", "Matthew", "Romans", "Galatians", "Ephesians",
  "Philemon", "Hebrews", "Genesis", "Exodus", "Ruth", "Ezra", "Job", "Joel", "Amos", "Jonah",
  "Micah", "Nahum", "Haggai", "Malachi", "Mark", "Luke", "John", "Acts", "James", "Titus", "Jude"
]

def plain_text(value)
  CGI.unescapeHTML(value.to_s.gsub(/<[^>]+>/, " ").gsub(/\s+/, " ").strip)
end

sermons_by_id = {}

feed_files.each do |filename|
  document = REXML::Document.new(File.read(filename))
  REXML::XPath.each(document, "//item") do |item|
    title = plain_text(item.elements["title"]&.text)
    source_url = plain_text(item.elements["link"]&.text)
    guid = plain_text(item.elements["guid"]&.text)
    description = plain_text(item.elements["description"]&.text)
      .sub(/\s*The post .*? appeared first on New Covenant OPC\.?$/i, "")
      .strip
    audio_url = CGI.unescapeHTML(item.elements["enclosure"]&.attributes&.fetch("url", "").to_s)
    id = guid[/[?&]p=(\d+)/, 1] || source_url.split("/").reject(&:empty?).last
    next if title.empty? || source_url.empty? || id.to_s.empty?

    book_aliases = {
      /^Psalm\b/i => "Psalms",
      /^Song of Songs\b/i => "Song of Solomon",
      /^1st Peter\b/i => "1 Peter"
    }
    book = book_aliases.find { |pattern, _name| title.match?(pattern) }&.last
    book ||= books.find { |name| title.match?(/^#{Regexp.escape(name)}\b/i) }
    book ||= books.find { |name| description.match?(/\b#{Regexp.escape(name)}\s+\d/i) }

    sermons_by_id[id.to_s] = {
      id: id.to_s,
      title: title,
      book: book || "",
      date: DateTime.parse(plain_text(item.elements["pubDate"]&.text)).strftime("%Y-%m-%d"),
      description: description,
      audioUrl: audio_url,
      sourceUrl: source_url
    }
  end
rescue REXML::ParseException => error
  warn "Skipped #{filename}: #{error.message}"
end

sermons = sermons_by_id.values.sort_by { |sermon| [sermon[:date], sermon[:id]] }.reverse
FileUtils.mkdir_p(File.dirname(output_path))
File.write(output_path, JSON.pretty_generate({ sermons: sermons }) + "\n")

puts "Migrated #{sermons.length} sermons from #{feed_files.length} feed pages to #{output_path}."
puts "#{sermons.count { |sermon| !sermon[:audioUrl].empty? }} include MP3 audio; #{sermons.count { |sermon| sermon[:book].empty? }} need a book assigned manually."
