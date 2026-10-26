import { SurahMindMap, MindMapNode } from '../../types';
import { SURAHS_LIST } from '../surahs';

export const THEME_COLORS = {
  blue: '#2563EB',     // العقيدة والتوحيد
  green: '#16A34A',    // العبادة والعمل الصالح
  amber: '#D97706',    // منهج الحياة والتشريع
  purple: '#7C3AED',   // القصص والسنن الإلهية
  rose: '#E11D48',     // مشاهد يوم القيامة والجزاء
  teal: '#0D9488',     // الأخلاق والتزكية
  indigo: '#4F46E5',   // الدعوة والرسالة
};

export const SURAH_MINDMAPS: Record<number, SurahMindMap> = {
  // سورة الفاتحة (Page 7 in Noor-Book)
  1: {
    surahNumber: 1,
    surahName: "الفاتحة",
    totalVerses: 7,
    centralTheme: "أم الكتاب ومجمل أصول الدين",
    scholarReference: "صفية السحيباني / د. إبراهيم الدويش",
    referenceImageIndex: 7,
    branches: [
      {
        id: "1-1",
        title: "العقيدة (الثناء على الله وتوحيده)",
        ayahRange: { start: 1, end: 4 },
        color: THEME_COLORS.blue,
        description: "إثبات الحمد لله، وتفرده بالربوبية والرحمة الواسعة وملك يوم الدين",
        children: [
          { id: "1-1-1", title: "الحمد لله رب العالمين (آية 2)", color: THEME_COLORS.blue },
          { id: "1-1-2", title: "الرحمن الرحيم (آية 3)", color: THEME_COLORS.blue },
          { id: "1-1-3", title: "مالك يوم الدين (آية 4)", color: THEME_COLORS.blue },
        ]
      },
      {
        id: "1-2",
        title: "العبادة (حقيقة التوحيد والتوكل)",
        ayahRange: { start: 5, end: 5 },
        color: THEME_COLORS.green,
        description: "إخلاص العبادة والاستعانة بالله وحده لا شريك له",
        children: [
          { id: "1-2-1", title: "إياك نعبد (إخلاص العمل)", color: THEME_COLORS.green },
          { id: "1-2-2", title: "وإياك نستعين (طلب العون والتوفيق)", color: THEME_COLORS.green },
        ]
      },
      {
        id: "1-3",
        title: "منهج حياة (طلب الهداية والصراط المستقيم)",
        ayahRange: { start: 6, end: 7 },
        color: THEME_COLORS.amber,
        description: "الدعاء بالثبات على صراط المنعم عليهم وتجنب طريق المغضوب عليهم والضالين",
        children: [
          { id: "1-3-1", title: "اهدنا الصراط المستقيم (آية 6)", color: THEME_COLORS.amber },
          { id: "1-3-2", title: "صراط الذين أنعمت عليهم (آية 7)", color: THEME_COLORS.amber },
          { id: "1-3-3", title: "غير المغضوب عليهم ولا الضالين (آية 7)", color: THEME_COLORS.rose },
        ]
      }
    ]
  },

  // سورة البقرة (Page 8 in Noor-Book)
  2: {
    surahNumber: 2,
    surahName: "البقرة",
    totalVerses: 286,
    centralTheme: "الإستخلاف في الأرض ومنهجه",
    scholarReference: "صفية السحيباني / د. إبراهيم الدويش",
    referenceImageIndex: 8,
    branches: [
      {
        id: "2-1",
        title: "أصناف الناس في العبادة والقبول",
        ayahRange: { start: 1, end: 20 },
        color: THEME_COLORS.rose,
        description: "بيان أصناف المكلفين: المؤمنون، الكافرون، والمنافقون",
        children: [
          { id: "2-1-1", title: "صفات المتقين المؤمنين (آيات 1-5)", ayahRange: { start: 1, end: 5 }, color: THEME_COLORS.green },
          { id: "2-1-2", title: "صفات الكافرين المعاندين (آيات 6-7)", ayahRange: { start: 6, end: 7 }, color: THEME_COLORS.rose },
          { id: "2-1-3", title: "صفات المنافقين ومرض قلوبهم (آيات 8-20)", ayahRange: { start: 8, end: 20 }, color: THEME_COLORS.amber },
        ]
      },
      {
        id: "2-2",
        title: "العبودية وأهميتها وبداية الخلق",
        ayahRange: { start: 21, end: 39 },
        color: THEME_COLORS.green,
        description: "الدعوة لعبادة الله، والدلائل الكونية، وقصة بداية الاستخلاف في الأرض",
        children: [
          { id: "2-2-1", title: "العبودية وأهميتها ودلائل الوحدانية (آيات 21-29)", ayahRange: { start: 21, end: 29 }, color: THEME_COLORS.blue },
          { id: "2-2-2", title: "قصة بداية الاستخلاف وخلق آدم (آيات 30-39)", ayahRange: { start: 30, end: 39 }, color: THEME_COLORS.purple },
        ]
      },
      {
        id: "2-3",
        title: "الاستجابة وحقيقة العبودية (نموذجان)",
        ayahRange: { start: 40, end: 152 },
        color: THEME_COLORS.blue,
        description: "مقارنة بين النموذج السلبي (بنو إسرائيل) والنموذج الإيجابي (إبراهيم عليه السلام)",
        children: [
          {
            id: "2-3-1",
            title: "المثال السلبي: بنو إسرائيل ونقض العهد (آيات 40-123)",
            ayahRange: { start: 40, end: 123 },
            color: THEME_COLORS.rose,
            children: [
              { id: "2-3-1-1", title: "تذكير بني إسرائيل بالنعم ونقض الميثاق (40-103)", ayahRange: { start: 40, end: 103 } },
              { id: "2-3-1-2", title: "توجيه في حقيقة العبودية لبني إسرائيل (104-123)", ayahRange: { start: 104, end: 123 } },
            ]
          },
          {
            id: "2-3-2",
            title: "المثال الإيجابي: إبراهيم عليه السلام والقبلة (آيات 124-152)",
            ayahRange: { start: 124, end: 152 },
            color: THEME_COLORS.teal,
            children: [
              { id: "2-3-2-1", title: "ابتلاء إبراهيم وإمامته وبناء البيت (124-141)", ayahRange: { start: 124, end: 141 } },
              { id: "2-3-2-2", title: "تحويل القبلة واستقلال الأمة المسلمة (142-152)", ayahRange: { start: 142, end: 152 } },
            ]
          }
        ]
      },
      {
        id: "2-4",
        title: "شمولية العبادة لجميع مناحي الحياة والأحكام",
        ayahRange: { start: 153, end: 253 },
        color: THEME_COLORS.purple,
        description: "تشريعات الصبر، القصاص، الصيام، الحج، الجهاد، الأسرة، والمال",
        children: [
          { id: "2-4-1", title: "الابتلاء والصبر واليقين (153-158)", ayahRange: { start: 153, end: 158 }, color: THEME_COLORS.teal },
          { id: "2-4-2", title: "علامات العبودية والإنفاق والحلال والحرام (159-167)", ayahRange: { start: 159, end: 167 }, color: THEME_COLORS.blue },
          { id: "2-4-3", title: "الحياة والعبادة: القصاص والوصية والصيام (168-214)", ayahRange: { start: 168, end: 214 }, color: THEME_COLORS.amber },
          { id: "2-4-4", title: "الأسرة وأحكامها: النكاح والطلاق والرضاع (215-242)", ayahRange: { start: 215, end: 242 }, color: THEME_COLORS.green },
          { id: "2-4-5", title: "قصة طالوت وجالوت وأثر الاستجابة (243-253)", ayahRange: { start: 243, end: 253 }, color: THEME_COLORS.purple },
        ]
      },
      {
        id: "2-5",
        title: "التعظيم أس العبودية وخاتمة السورة",
        ayahRange: { start: 254, end: 286 },
        color: THEME_COLORS.amber,
        description: "آية الكرسي، براهين التوحيد، آداب الإنفاق، أحكام الربا، والدعاء الجامع",
        children: [
          { id: "2-5-1", title: "قصص التعظيم والتوحيد وآية الكرسي (254-260)", ayahRange: { start: 254, end: 260 }, color: THEME_COLORS.blue },
          { id: "2-5-2", title: "الصدقة وبرهان العبودية والتحذير من الربا (261-283)", ayahRange: { start: 261, end: 283 }, color: THEME_COLORS.green },
          { id: "2-5-3", title: "ختم السورة بالتأكيد أن العبادة لله وحده والدعاء (284-286)", ayahRange: { start: 284, end: 286 }, color: THEME_COLORS.indigo },
        ]
      }
    ]
  },

  // سورة آل عمران (Page 9 in Noor-Book)
  3: {
    surahNumber: 3,
    surahName: "آل عمران",
    totalVerses: 200,
    centralTheme: "الثبات (فكرياً وداخلياً)",
    scholarReference: "صفية السحيباني / د. إبراهيم الدويش",
    referenceImageIndex: 9,
    branches: [
      {
        id: "3-1",
        title: "الثبات فكرياً في مواجهة الأفكار الخارجية والشبهات",
        ayahRange: { start: 1, end: 120 },
        color: THEME_COLORS.purple,
        description: "ترسيخ العقيدة والرد على شبهات أهل الكتاب وإثبات نبوة عيسى عليه السلام",
        children: [
          { id: "3-1-1", title: "قدرة الله وتوحيده وعلمه (1-6)", ayahRange: { start: 1, end: 6 }, color: THEME_COLORS.blue },
          { id: "3-1-2", title: "انقسام الناس في فهم المتشابه والتجاء الراسخين (7-9)", ayahRange: { start: 7, end: 9 }, color: THEME_COLORS.teal },
          { id: "3-1-3", title: "عاقبة الكافرين والتحذير من الغرور بالشهوات (10-17)", ayahRange: { start: 10, end: 17 }, color: THEME_COLORS.rose },
          { id: "3-1-4", title: "وحدانية الله وإقامة الحجة وطبيعة أهل الكتاب (18-25)", ayahRange: { start: 18, end: 25 }, color: THEME_COLORS.amber },
          { id: "3-1-5", title: "قصة آل عمران ومريم وزكريا وولادة عيسى (33-59)", ayahRange: { start: 33, end: 59 }, color: THEME_COLORS.green },
          { id: "3-1-6", title: "محاجة أهل الكتاب وحادثة المباهلة وتوحيد الأمة (60-91)", ayahRange: { start: 60, end: 91 }, color: THEME_COLORS.indigo },
          { id: "3-1-7", title: "البر بالإنفاق ومكانة البيت الحرام والاعتصام بالله (92-120)", ayahRange: { start: 92, end: 120 }, color: THEME_COLORS.teal },
        ]
      },
      {
        id: "3-2",
        title: "كيفية الثبات داخلياً وعملياً في الشدائد",
        ayahRange: { start: 121, end: 200 },
        color: THEME_COLORS.amber,
        description: "دروس غزوة أحد، معالجة الهزيمة النفسية، والترغيب في الصبر والتوكل",
        children: [
          { id: "3-2-1", title: "غزوة بدر وغزوة أحد واستحضار أسباب النصر (121-129)", ayahRange: { start: 121, end: 129 }, color: THEME_COLORS.blue },
          { id: "3-2-2", title: "واجبات المؤمنين: اجتناب الربا والمسارعة للمغفرة (130-141)", ayahRange: { start: 130, end: 141 }, color: THEME_COLORS.green },
          { id: "3-2-3", title: "تثبيت قلوب المؤمنين وأسباب الابتلاء في أحد (142-164)", ayahRange: { start: 142, end: 164 }, color: THEME_COLORS.rose },
          { id: "3-2-4", title: "منزلة الشهداء والتحذير من وسوسة الشيطان والبخل (165-188)", ayahRange: { start: 165, end: 188 }, color: THEME_COLORS.purple },
          { id: "3-2-5", title: "دعاء أولي الألباب والتفكر في خلق السموات والأرض (189-200)", ayahRange: { start: 189, end: 200 }, color: THEME_COLORS.teal },
        ]
      }
    ]
  },

  // سورة الكهف (Page 24 in Noor-Book)
  18: {
    surahNumber: 18,
    surahName: "الكهف",
    totalVerses: 110,
    centralTheme: "العصمة من الفتن الأربع بالاستمساك بالدين",
    scholarReference: "صفية السحيباني / د. إبراهيم الدويش",
    referenceImageIndex: 24,
    branches: [
      {
        id: "18-1",
        title: "فتنة الدين: قصة أصحاب الكهف وسفينة النجاة",
        ayahRange: { start: 9, end: 31 },
        color: THEME_COLORS.blue,
        description: "الفرار بالدين والثبات على الحق وعاقبة اللجوء إلى الله والقرين الصالح",
        children: [
          { id: "18-1-1", title: "لجوء الفتية إلى الكهف ومعجزة الرقود (9-22)", ayahRange: { start: 9, end: 22 } },
          { id: "18-1-2", title: "علاج فتنة الدين: الصحبة الصالحة والاستمساك بالذكر (23-31)", ayahRange: { start: 23, end: 31 } },
        ]
      },
      {
        id: "18-2",
        title: "فتنة المال والغرور: قصة صاحب الجنتين",
        ayahRange: { start: 32, end: 49 },
        color: THEME_COLORS.green,
        description: "مقارنة بين المؤمن الشاكر والكافر المغتر بماله وزوال نعيم الدنيا",
        children: [
          { id: "18-2-1", title: "حوار صاحب الجنتين مع صاحبه المؤمن وهلاك البستان (32-44)", ayahRange: { start: 32, end: 44 } },
          { id: "18-2-2", title: "علاج فتنة المال: إدراك حقيقة الدنيا وعرض القيامة (45-49)", ayahRange: { start: 45, end: 49 } },
        ]
      },
      {
        id: "18-3",
        title: "فتنة العلم: قصة موسى والخضر عليهما السلام",
        ayahRange: { start: 60, end: 82 },
        color: THEME_COLORS.purple,
        description: "التواضع في طلب العلم وحكمة الأقدار الخفية والرحمة",
        children: [
          { id: "18-3-1", title: "رحلة موسى للبحث عن الخضر وأدب التعلم (60-70)", ayahRange: { start: 60, end: 70 } },
          { id: "18-3-2", title: "المواقف الثلاثة وتأويل الحكمة والرحمة الإلهية (71-82)", ayahRange: { start: 71, end: 82 } },
        ]
      },
      {
        id: "18-4",
        title: "فتنة السلطة والقوة: قصة ذي القرنين وسد يأجوج ومأجوج",
        ayahRange: { start: 83, end: 110 },
        color: THEME_COLORS.amber,
        description: "تسخير القوة لخدمة الضعفاء وإقامة العدل ونبذ الغرور",
        children: [
          { id: "18-4-1", title: "تمكين ذي القرنين ورحلاته في الأرض وبناء السد (83-98)", ayahRange: { start: 83, end: 98 } },
          { id: "18-4-2", title: "علاج فتنة السلطة: الإخلاص لله وختام السورة العظيم (99-110)", ayahRange: { start: 99, end: 110 } },
        ]
      }
    ]
  },

  // سورة يس (Page 42 in Noor-Book)
  36: {
    surahNumber: 36,
    surahName: "يس",
    totalVerses: 83,
    centralTheme: "قلب القرآن: إحياء القلوب بالوحي والبعث والجزاء",
    scholarReference: "صفية السحيباني / د. إبراهيم الدويش",
    referenceImageIndex: 42,
    branches: [
      {
        id: "36-1",
        title: "الرسالة والوحي وقصة أصحاب القرية",
        ayahRange: { start: 1, end: 32 },
        color: THEME_COLORS.indigo,
        description: "تأكيد نبوة محمد ﷺ وموقف المكذبين وقصة حبيب النجار شهيد الدعوة",
        children: [
          { id: "36-1-1", title: "القسم بالقرآن الحكيم وصدق الرسالة (1-12)", ayahRange: { start: 1, end: 12 } },
          { id: "36-1-2", title: "قصة أصحاب القرية والمرسلين والرجل المؤمن (13-32)", ayahRange: { start: 13, end: 32 } },
        ]
      },
      {
        id: "36-2",
        title: "آيات القدرة الإلهية ودلائل البعث في الكون",
        ayahRange: { start: 33, end: 50 },
        color: THEME_COLORS.blue,
        description: "الأرض الميتة، الليل والنهار، حركة الشمس والقمر، والفلك المشحون",
        children: [
          { id: "36-2-1", title: "إحياء الأرض الميتة والزروع (33-36)", ayahRange: { start: 33, end: 36 } },
          { id: "36-2-2", title: "نظام الأفلاك والكون والبحار (37-44)", ayahRange: { start: 37, end: 44 } },
          { id: "36-2-3", title: "إعراض المشركين عن الإنفاق والآيات (45-50)", ayahRange: { start: 45, end: 50 } },
        ]
      },
      {
        id: "36-3",
        title: "مشاهد يوم القيامة وتمايز أهل الجنة وأهل النار",
        ayahRange: { start: 51, end: 68 },
        color: THEME_COLORS.rose,
        description: "نفخة الصور، سلام من رب رحيم للمؤمنين، وامتازوا اليوم أيها المجرمون",
        children: [
          { id: "36-3-1", title: "البعث والنشور ونعيم أصحاب الجنة (51-58)", ayahRange: { start: 51, end: 58 } },
          { id: "36-3-2", title: "موقف المجرمين وشهادة الجوارح عليهم (59-68)", ayahRange: { start: 59, end: 68 } },
        ]
      },
      {
        id: "36-4",
        title: "حتمية البعث والقدرة المطلقة (كن فيكون)",
        ayahRange: { start: 69, end: 83 },
        color: THEME_COLORS.teal,
        description: "الرد على منكر البعث الذي قال من يحيي العظام وهي رميم وتنزيه الخالق",
        children: [
          { id: "36-4-1", title: "القرآن تذكرة وتنـزيه النبي عن الشعر (69-76)", ayahRange: { start: 69, end: 76 } },
          { id: "36-4-2", title: "برهان خلق الإنسان أول مرة وأمر الله بين الكاف والنون (77-83)", ayahRange: { start: 77, end: 83 } },
        ]
      }
    ]
  },

  // سورة الملك (Page 63 in Noor-Book)
  67: {
    surahNumber: 67,
    surahName: "الملك",
    totalVerses: 30,
    centralTheme: "إتقان الملك والابتلاء بالحياة والموت والمنجية من عذاب القبر",
    scholarReference: "صفية السحيباني / د. إبراهيم الدويش",
    referenceImageIndex: 63,
    branches: [
      {
        id: "67-1",
        title: "عظمة الملك وإتقان الخلق والابتلاء",
        ayahRange: { start: 1, end: 5 },
        color: THEME_COLORS.blue,
        description: "تبارك الذي بيده الملك، خلق الموت والحياة ليبلوكم أيكم أحسن عملاً، وخلق السموات السبع",
      },
      {
        id: "67-2",
        title: "عاقبة الكافرين واعترافهم في النار",
        ayahRange: { start: 6, end: 11 },
        color: THEME_COLORS.rose,
        description: "سؤال خزنة جهنم للمكذبين: ألم يأتكم نذير؟ واعترافهم: لو كنا نسمع أو نعقل ما كنا في أصحاب السعير",
      },
      {
        id: "67-3",
        title: "خشية الله بالغيب وعلمه بالسرائر",
        ayahRange: { start: 12, end: 15 },
        color: THEME_COLORS.teal,
        description: "إن الذين يخشون ربهم بالغيب لهم مغفرة وأجر كبير، وأسروا قولكم أو اجهروا به إنه عليم بذات الصدور",
      },
      {
        id: "67-4",
        title: "التحذير من الأمن من مكر الله ونعمة الرزق",
        ayahRange: { start: 16, end: 24 },
        color: THEME_COLORS.amber,
        description: "أأمنتم من في السماء أن يخسف بكم الأرض أو يرسل عليكم حاصباً، والتفكر في الطير والرزق",
      },
      {
        id: "67-5",
        title: "التوكل على الرحمن وطلب الماء المعين",
        ayahRange: { start: 25, end: 30 },
        color: THEME_COLORS.green,
        description: "قل هو الرحمن آمنا به وعليه توكلنا، قل أرأيتم إن أصبح ماؤكم غوراً فمن يأتيكم بماء معين",
      }
    ]
  },

  // سورة الإخلاص
  112: {
    surahNumber: 112,
    surahName: "الإخلاص",
    totalVerses: 4,
    centralTheme: "صفة الرحمن وتفرده بالصمدية وتنزيهه عن الشبيه والمثل",
    branches: [
      { id: "112-1", title: "إثبات الأحدية لله (آية 1)", ayahRange: { start: 1, end: 1 }, color: THEME_COLORS.blue },
      { id: "112-2", title: "إثبات الصمدية وحاجة كل الخلق إليه (آية 2)", ayahRange: { start: 2, end: 2 }, color: THEME_COLORS.green },
      { id: "112-3", title: "تنزيه الله عن الولادة والنسب (آية 3)", ayahRange: { start: 3, end: 3 }, color: THEME_COLORS.purple },
      { id: "112-4", title: "نفي الكفء والنظير والمثل (آية 4)", ayahRange: { start: 4, end: 4 }, color: THEME_COLORS.amber },
    ]
  },

  // سورة الفلق
  113: {
    surahNumber: 113,
    surahName: "الفلق",
    totalVerses: 5,
    centralTheme: "الاستعاذة برب الفلق من الشرور الخارجية والمادية والخفية",
    branches: [
      { id: "113-1", title: "الاستعاذة برب الصبح والنور (آية 1)", ayahRange: { start: 1, end: 1 }, color: THEME_COLORS.blue },
      { id: "113-2", title: "الاستعاذة العامة من شر كل المخلوقات (آية 2)", ayahRange: { start: 2, end: 2 }, color: THEME_COLORS.rose },
      { id: "113-3", title: "الاستعاذة من شر الليل إذا أظلم ودخل (آية 3)", ayahRange: { start: 3, end: 3 }, color: THEME_COLORS.purple },
      { id: "113-4", title: "الاستعاذة من شر السحر والنفث في العقد (آية 4)", ayahRange: { start: 4, end: 4 }, color: THEME_COLORS.amber },
      { id: "113-5", title: "الاستعاذة من شر الحاسد إذا حسد (آية 5)", ayahRange: { start: 5, end: 5 }, color: THEME_COLORS.teal },
    ]
  },

  // سورة الناس
  114: {
    surahNumber: 114,
    surahName: "الناس",
    totalVerses: 6,
    centralTheme: "الاستعاذة برب الناس وملكهم من الشرور الداخلية والوسوسة",
    branches: [
      { id: "114-1", title: "التوسل بأسماء الربوبية والملك والألوهية (آيات 1-3)", ayahRange: { start: 1, end: 3 }, color: THEME_COLORS.blue },
      { id: "114-2", title: "حقيقة الوسواس الخناس وطبيعته عند الذكر (آية 4)", ayahRange: { start: 4, end: 4 }, color: THEME_COLORS.rose },
      { id: "114-3", title: "مكان الوسوسة في صدور الناس (آية 5)", ayahRange: { start: 5, end: 5 }, color: THEME_COLORS.amber },
      { id: "114-4", title: "بيان مصدر الوسواس من شياطين الجنة والناس (آية 6)", ayahRange: { start: 6, end: 6 }, color: THEME_COLORS.purple },
    ]
  }
};

// Generates fallback mind maps automatically for any surah not explicitly detailed above
export function getSurahMindMap(surahNumber: number): SurahMindMap {
  if (SURAH_MINDMAPS[surahNumber]) {
    return SURAH_MINDMAPS[surahNumber];
  }

  const surahMeta = SURAHS_LIST.find(s => s.number === surahNumber);
  const totalVerses = surahMeta ? surahMeta.totalVerses : 10;
  const surahName = surahMeta ? surahMeta.name : `سورة ${surahNumber}`;
  const mainTheme = surahMeta?.mainTheme || "مقاصد وهدايات السورة";

  // Divide into 3-4 sensible branches
  const segment1End = Math.max(1, Math.floor(totalVerses * 0.3));
  const segment2End = Math.max(segment1End + 1, Math.floor(totalVerses * 0.7));

  return {
    surahNumber,
    surahName,
    totalVerses,
    centralTheme: mainTheme,
    scholarReference: "الخرائط الذهنية لسور القرآن الكريم",
    referenceImageIndex: surahMeta?.referencePageImage ? parseInt(surahMeta.referencePageImage.match(/\d+/)?.[0] || '1') : undefined,
    branches: [
      {
        id: `${surahNumber}-b1`,
        title: `مقدمة السورة وترسيخ المقصد (1 - ${segment1End})`,
        ayahRange: { start: 1, end: segment1End },
        color: THEME_COLORS.blue,
        description: "افتتاحية السورة وبداية بيان مقاصدها ودعائم التوحيد والإيمان",
      },
      {
        id: `${surahNumber}-b2`,
        title: `الموضوع الرئيسي والدلائل والعبر (${segment1End + 1} - ${segment2End})`,
        ayahRange: { start: segment1End + 1, end: segment2End },
        color: THEME_COLORS.green,
        description: "محور السورة وقصصها وأحكامها ومواقف الاستجابة والابتلاء",
      },
      {
        id: `${surahNumber}-b3`,
        title: `خاتمة السورة والمصير والوعد (${segment2End + 1} - ${totalVerses})`,
        ayahRange: { start: segment2End + 1, end: totalVerses },
        color: THEME_COLORS.amber,
        description: "تأكيد العاقبة للمتقين وجزاء المكذبين والأمر بالصبر والتسبيح",
      }
    ]
  };
}

/**
 * Returns the theme category and color for an ayah in a specific surah
 */
export function getAyahTheme(surahNumber: number, ayahNumber: number) {
  const mindMap = getSurahMindMap(surahNumber);
  for (const branch of mindMap.branches) {
    if (branch.ayahRange && ayahNumber >= branch.ayahRange.start && ayahNumber <= branch.ayahRange.end) {
      return {
        name: branch.title,
        color: branch.color || '#2563EB',
        branchId: branch.id,
      };
    }
    if (branch.children) {
      for (const child of branch.children) {
        if (child.ayahRange && ayahNumber >= child.ayahRange.start && ayahNumber <= child.ayahRange.end) {
          return {
            name: child.title,
            color: child.color || branch.color || '#2563EB',
            branchId: child.id,
          };
        }
      }
    }
  }
  return {
    name: mindMap.centralTheme,
    color: '#3B82F6',
    branchId: 'default',
  };
}
