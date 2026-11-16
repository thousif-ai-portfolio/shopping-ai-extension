// Everyday words. With full brand lists (Flipkart lists ~2,000 brands) many brands start with
// or resemble ordinary words: "Good One", "Latest Chikan", "Under Armour", "SYMPLE", "port".
// These words are never typo-corrected, never used as a short form of a longer name, and never
// matched to a one-word brand. Exact attribute values ("Winter", "Slim", "Party") still match.
export const COMMON = new Set(
  `a about above after again all also always am an and any are around as at away back bad be because been
before below best better between big bit both but buy by can cheap cheaper cheapest classic clean college
come comfort comfortable comfy cool could daily dark day dad deal decent different do does done dont down
each easy else even every everyday extra fancy fashion fashionable fast few find fine first fit for free
fresh friend from full fun get gift girl give go good great half happy hard has have he heavy hello help her
here high him his home hot how i if in inside is it its just keep kid kids kind latest leave less let life
light lightweight like line lined lining little long look looking lot love low made make man many may me mom more most much
must my need new next nice night no normal not now of off office old on one only open or other our out
outside over own pair part people perfect place plain please plus premium pretty proper quality quick
quiet quite rain real really regular right same school see seen sell set she should show simple single
size small smart so soft some something special sport sports stay still strong style stylish such super
sure take than thanks that the their them then there these they thing things this those through to today
too top trendy try under up upto us use used useful very want warm was water way we wear wearing weather
well were what when where which while white who why will wish with within without women work would year
yes you young your
phone phones mobile mobiles smartphone shoe shoes sneaker sneakers jacket jackets kurta kurtas kurti shirt
shirts tshirt dress dresses jeans pant pants trouser trousers tops saree sarees bag bags watch watches
case cover screen camera battery charger charging storage memory display power speed model brand brands
color colour price cost budget value money rated rating star stars review reviews offer offers discount
newest wedding party festival casual formal ethnic summer winter travel gym running walking
outdoor indoor
black grey gray red blue green yellow pink purple orange brown beige navy maroon olive gold silver
cream ivory khaki teal violet magenta peach multi multicolor
sort sorted order filter filters remove clear reset switch change replace instead rather swap hatao
compare worth thousand lakh dikhao chahiye wala wali joota joote jutti kapde dupatta`.split(/\s+/),
)
