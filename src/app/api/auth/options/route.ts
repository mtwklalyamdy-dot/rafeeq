import { db } from "@/db";
import { colleges, departments, levels } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Fetch currently registered data
    const dbColleges = await db.select().from(colleges);
    const dbDepartments = await db.select().from(departments);
    const dbLevels = await db.select().from(levels);

    // Build hierarchical structure with dynamic values from DB combined with standard defaults
    // Pre-filled high quality academic structure
    const defaultData = [
      {
        university: "جامعة الحديدة",
        colleges: [
          {
            name: "كلية التجارة والاقتصاد",
            departments: ["المحاسبة", "إدارة الأعمال", "التسويق"]
          },
          {
            name: "كلية علوم وهندسة الحاسوب",
            departments: ["علوم حاسوب", "تقنية معلومات", "هندسة برمجيات"]
          }
        ]
      },
      {
        university: "جامعة صنعاء",
        colleges: [
          {
            name: "كلية الهندسة",
            departments: ["هندسة مدنية", "هندسة معمارية", "هندسة حاسبات"]
          },
          {
            name: "كلية الحاسوب وتكنولوجيا المعلومات",
            departments: ["تقنية معلومات", "علوم حاسوب", "نظم معلومات"]
          }
        ]
      }
    ];

    // Merge DB values into the list to avoid losing any customized administrative data
    dbColleges.forEach((col) => {
      let univObj = defaultData.find((d) => d.university.trim() === col.university.trim());
      if (!univObj) {
        univObj = { university: col.university, colleges: [] };
        defaultData.push(univObj);
      }
      let colObj = univObj.colleges.find((c) => c.name.trim() === col.nameAr.trim());
      if (!colObj) {
        colObj = { name: col.nameAr, departments: [] };
        univObj.colleges.push(colObj);
      }

      // Add departments of this college
      dbDepartments
        .filter((d) => d.collegeId === col.id)
        .forEach((dept) => {
          if (!colObj.departments.includes(dept.nameAr)) {
            colObj.departments.push(dept.nameAr);
          }
        });
    });

    const levelList = dbLevels.length 
      ? dbLevels.map(l => ({ id: l.id, nameAr: l.nameAr, sortOrder: l.sortOrder }))
      : [
          { nameAr: "المستوى الأول", sortOrder: 1 },
          { nameAr: "المستوى الثاني", sortOrder: 2 },
          { nameAr: "المستوى الثالث", sortOrder: 3 },
          { nameAr: "المستوى الرابع", sortOrder: 4 }
        ];

    return Response.json({
      universities: defaultData,
      levels: levelList.sort((a, b) => a.sortOrder - b.sortOrder)
    });
  } catch (error) {
    return Response.json({ error: "تعذر تحميل الخيارات الأكاديمية" }, { status: 500 });
  }
}
