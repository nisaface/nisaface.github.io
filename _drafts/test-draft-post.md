---
layout: post
title: "Test Draft Post"
subtitle: "Subtitle Here"
category: blog
image: "http://placekitten.com/g/1000/500"
---

The image field can be a reference to a local file `foo.jpg` or a full domain `http://placekitten.com/g/200/200`

If you want to include a "Read More" link and continue the post on the single post page, just include a `<!-- more -->` tag in the text where you want a break.

<!-- more -->

Links are formatted like [Kramdown flavored markdown reference](http://kramdown.gettalong.org/quickref.html).

This is a text with a footnote[^1].

[^1]: And here is the definition.

> A sample blockquote.
>
> >Nested blockquotes are
> >also possible.
>
> ## Headers work too
> This is the outer quote again.
>
> <cite>Citation: Josh</cite>

1. This is a list item
2. And another item
2. And the third one
   with additional text

* Item one
* Item two
* Item three

You can add a class to something by following the line with this code `{: .class1}`
{: .class1}

# Header 1

## Header 2

### Header 3

This is *emphasized*, _this_ too!

This is **strong**, __this__ too!

![Image Test](http://placekitten.com/g/200/300)

This next image will take up the "full" width (up to 1000px). It has a class of `{: .full}`

![Image Test](http://placekitten.com/g/1000/500)
{: .full}
